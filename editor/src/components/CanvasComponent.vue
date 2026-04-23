<template>
  <div
      ref="wrapper"
      class="relative flex-1 h-full min-w-0 overflow-hidden"
      @dragover.prevent
      @drop="handleDrop"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="cancelSelection"
      @contextmenu.prevent="cancelSelection"
  >
    <canvas ref="cnv" class="block w-full h-full" />

    <input
      v-if="inlineEditor.visible"
      ref="inlineInput"
      type="text"
      inputmode="numeric"
      :value="inlineEditor.raw"
      :style="inlineEditor.style"
      class="absolute border-2 border-blue-500 rounded text-center bg-white outline-none z-50"
      @input="inlineEditor.raw = ($event.target as HTMLInputElement).value"
      @keydown.enter.prevent="commitInline"
      @keydown.escape.prevent="cancelInline"
      @blur="commitInline"
    />

    <div class="absolute inset-0 pointer-events-none">
      <GraphTimeSeries
          v-for="g in graphs"
          v-show="!movingGraphIds.has(g.id)"
          :key="g.id"
          :yMax="g.customProps?.yMax ?? 100"
          :yStep="g.customProps?.yStep ?? 20"
          :timeStep="g.customProps?.timeStep ?? 1"
          :timePoints="g.customProps?.timePoints ?? 20"
          :value="getGraphValue(g)"
          :isRuntime="isRuntime"
          :style="getGraphStyle(g)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import GraphTimeSeries from './GraphTimeSeries.vue'
import {onBeforeUnmount, onMounted, ref, watch, computed} from 'vue'
import {fabric} from 'fabric'
import {ElementRegistry} from '../elements'
import type {ElementType} from '../elements'
import {setCanvas, isSuppressed, setSuppressSnapshots, registerHistoryControls} from '../composables/useCanvas'
import {useCanvasStore} from '../store/canvas'
import {useEditorStore} from '../store/editor'
import {useSessionStore} from '../store/session'
import {DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, zoomToPointTransform} from '../utils/zoom'

const wrapper = ref<HTMLElement>()
const cnv = ref<HTMLCanvasElement>()
const canvasStore = useCanvasStore()
const editorStore = useEditorStore()
const sessionStore = useSessionStore()
const graphs = ref<any[]>([])
const graphsVersion = ref(0)
const movingGraphIds = ref<Set<string>>(new Set())
const isRuntime = computed(() => editorStore.mode === 'runtime')

// ========== INLINE NUMBER EDITOR ==========
const inlineInput = ref<HTMLInputElement>()
const inlineEditor = ref({
  visible: false,
  raw: '',
  style: {} as Record<string, string>,
  target: null as any,
})

function calcInlineStyle(element: any): Record<string, string> {
  if (!canvas || !cnv.value) return {}
  const zoom = canvas.getZoom()
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const center = element.getCenterPoint()
  const inputRect = typeof element.getInputRect === 'function'
    ? element.getInputRect()
    : { width: element.width ?? 120, height: element.height ?? 40, offsetX: 0, offsetY: 0 }
  const elW = inputRect.width * (element.scaleX ?? 1) * zoom
  const elH = inputRect.height * (element.scaleY ?? 1) * zoom
  const screenX = center.x * zoom + vpt[4]
  const screenY = center.y * zoom + vpt[5]
  const rectCenterX = screenX + (inputRect.offsetX ?? 0) * (element.scaleX ?? 1) * zoom
  const rectCenterY = screenY + (inputRect.offsetY ?? 0) * (element.scaleY ?? 1) * zoom
  const canvasRect = cnv.value.getBoundingClientRect()
  const wrapRect = wrapper.value!.getBoundingClientRect()
  const offsetX = canvasRect.left - wrapRect.left
  const offsetY = canvasRect.top - wrapRect.top
  return {
    left: `${offsetX + rectCenterX - elW / 2}px`,
    top: `${offsetY + rectCenterY - elH / 2}px`,
    width: `${elW}px`,
    height: `${elH}px`,
    fontSize: `${(element.customProps.fontSize ?? 24) * zoom * (element.scaleY ?? 1)}px`,
    fontFamily: element.customProps.fontFamily ?? 'Arial, sans-serif',
    fontWeight: element.customProps.fontWeight ?? 'normal',
  }
}

function refreshInlinePosition() {
  if (!inlineEditor.value.visible || !inlineEditor.value.target) return
  inlineEditor.value.style = calcInlineStyle(inlineEditor.value.target)
}

function openInlineEditor(element: any) {
  if (!wrapper.value || !canvas) return
  inlineEditor.value = {
    visible: true,
    raw: String(element.customProps.value),
    style: calcInlineStyle(element),
    target: element,
  }
  element.setEditing?.(true)
  setTimeout(() => { inlineInput.value?.focus(); inlineInput.value?.select() }, 0)
}

function commitInline() {
  if (!inlineEditor.value.visible) return
  const el = inlineEditor.value.target
  el?.commitValue?.(inlineEditor.value.raw)
  el?.setEditing?.(false)
  inlineEditor.value.visible = false
}

function cancelInline() {
  if (!inlineEditor.value.visible) return
  inlineEditor.value.target?.setEditing?.(false)
  inlineEditor.value.visible = false
}
// ========== END INLINE EDITOR ==========

let canvas!: fabric.Canvas
let resizeObserver: ResizeObserver | null = null
let isPanning = false
let isDragging = false
let lastPos = {x: 0, y: 0}
let applyingViewFromStore = false
let isSelecting = false
let selectionStart = { x: 0, y: 0 }
let selectionRect: fabric.Rect | null = null

const undoStack: string[] = []
const redoStack: string[] = []
let clipboard: fabric.Object[] = []

// ========== RUNTIME ==========
let runtimeInterval: number | null = null

const getVariableValue = (variableName: string): any => {
  // variableName формат: "outputs.inputs.varName" или "plant_outputs.outputs.varName"
  const parts = variableName.split('.')
  if (parts.length < 3) {
    console.warn(`Invalid variable path: "${variableName}"`)
    return 0
  }
  
  const [root, section, ...rest] = parts
  const varPath = rest.join('.')
  
  let source: any = null
  if (root === 'outputs') source = sessionStore.plc
  else if (root === 'plant_outputs') source = sessionStore.plant
  else {
    console.warn(`Unknown root in variable path: "${root}"`)
    return 0
  }
  
  // section: inputs, outputs, global_vars, global_inputs
  const sectionData = source?.[section] ?? source?.[section.replace('_', '')] ?? {}
  
  // Достаём значение по пути varPath из sectionData
  const value = varPath.split('.').reduce((obj, key) => obj?.[key], sectionData)
  
  if (value === undefined) {
    console.warn(`Variable "${variableName}" not found in session store`)
    return 0
  }
  
  return value
}

const updateRuntimeElements = () => {
  if (!canvas || editorStore.mode !== 'runtime') return
  const objects = canvas.getObjects()
  let hasUpdates = false
  objects.forEach(obj => {
    const element = obj as any
    if (typeof element.setState === 'function' && element.bindings) {
      const bindings = element.bindings
      if (bindings.inputs && Object.keys(bindings.inputs).length > 0) {
        const state: Record<string, any> = {}
        Object.entries(bindings.inputs).forEach(([pinName, variableName]) => {
          if (variableName && typeof variableName === 'string' && variableName.trim()) {
            state[pinName] = getVariableValue(variableName)
            hasUpdates = true
          }
        })
        if (Object.keys(state).length > 0) element.setState(state)
      }
    }
  })
  if (hasUpdates) canvas.requestRenderAll()
}

const startRuntime = () => {
  if (runtimeInterval) return
  updateRuntimeElements()
  runtimeInterval = window.setInterval(updateRuntimeElements, 1000)
}

const stopRuntime = () => {
  if (runtimeInterval) { clearInterval(runtimeInterval); runtimeInterval = null }
}

watch(() => editorStore.mode, (newMode) => {
  if (newMode === 'runtime') startRuntime()
  else { cancelInline(); stopRuntime() }
}, { immediate: true })
// ========== END RUNTIME ==========

function updateGraphs() {
  if (!canvas) return
  graphs.value = canvas.getObjects().filter((o: any) => o.elementType === 'time-graph')
}

function getGraphStyle(obj: any) {
  void graphsVersion.value
  if (!canvas) return { position: 'absolute', left: '0px', top: '0px', width: '0px', height: '0px' }
  const zoom = canvas.getZoom()
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const screenLeft = obj.left * zoom + vpt[4]
  const screenTop  = obj.top  * zoom + vpt[5]
  const screenW    = obj.width  * (obj.scaleX ?? 1) * zoom
  const screenH    = obj.height * (obj.scaleY ?? 1) * zoom
  return { position: 'absolute', left: screenLeft + 'px', top: screenTop + 'px', width: screenW + 'px', height: screenH + 'px' }
}

function getGraphValue(g: any): number {
  return typeof g.getCurrentValue === 'function' ? g.getCurrentValue() : 0
}

function updateSelection() {
  if (!canvas) return
  canvasStore.setSelection(canvas.getActiveObjects())
}

function snapshot() {
  if (isSuppressed()) return
  undoStack.push(JSON.stringify(canvas.toJSON(['id', 'customProps', 'elementType', 'bindings', 'meta'])))
  if (undoStack.length > 50) undoStack.shift()
  redoStack.length = 0
}

function loadState(json: any) {
  setSuppressSnapshots(true)
  canvas.clear()
  fabric.util.enlivenObjects(json.objects ?? [], (objs: fabric.Object[]) => {
    objs.forEach(obj => canvas.add(obj))
    canvas.renderAll()
    updateSelection()
    setSuppressSnapshots(false)
  }, 'fabric')
}

function copySelection() { clipboard = canvas.getActiveObjects().map(o => o) }

function pasteClipboard() {
  clipboard.forEach(source => {
    source.clone((clone: fabric.Object | null) => {
      if (!clone) return
      ;(clone as any).id = crypto.randomUUID()
      clone.set({ left: (clone.left ?? 0) + 20, top: (clone.top ?? 0) + 20 })
      canvas.add(clone)
      canvas.setActiveObject(clone)
      canvas.requestRenderAll()
      snapshot()
    }, ['id', 'customProps', 'elementType', 'bindings', 'meta'])
  })
}

function deleteSelection() {
  const items = canvas.getActiveObjects()
  items.forEach(obj => {
    obj.animate('opacity', '0', {
      duration: 200,
      onChange: canvas.renderAll.bind(canvas),
      onComplete: () => { canvas.remove(obj); snapshot() },
    })
  })
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  updateSelection()
}

function onSpaceDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"]')) return
  if (e.code !== 'Space' || isPanning) return
  isPanning = true
  canvas.selection = false
  canvas.defaultCursor = 'grab'
  e.preventDefault()
}

function onSpaceUp(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable ||
      target.closest('input, textarea, [contenteditable="true"]')) return
  if (e.code !== 'Space') return
  isPanning = false
  isDragging = false
  canvas.selection = true
  canvas.defaultCursor = 'default'
  e.preventDefault()
}

function cancelSelection() {
  if (!isSelecting || !selectionRect) return
  canvas.remove(selectionRect)
  selectionRect = null
  isSelecting = false
  canvas.selection = true
  canvas.requestRenderAll()
}

function onMouseDown(e: MouseEvent) {
  if (isPanning) {
    isDragging = true
    canvas.defaultCursor = 'grabbing'
    lastPos = {x: e.clientX, y: e.clientY}
    e.preventDefault()
    return
  }
  if (e.button !== 0) return
  const target = canvas.findTarget(e as unknown as MouseEvent, false)
  if (target) return
  const pointer = canvas.getPointer(e as unknown as MouseEvent)
  selectionStart = { x: pointer.x, y: pointer.y }
  isSelecting = true
  selectionRect = new fabric.Rect({
    left: selectionStart.x, top: selectionStart.y, width: 0, height: 0,
    fill: 'rgba(99, 102, 241, 0.1)', stroke: 'rgba(99, 102, 241, 0.6)',
    strokeWidth: 2, strokeDashArray: [5, 5],
    selectable: false, evented: false, absolutePositioned: true
  })
  canvas.add(selectionRect)
  canvas.selection = false
}

function syncViewToStore() {
  if (!canvas || applyingViewFromStore) return
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  canvasStore.setViewportTransform({ zoom: canvas.getZoom(), offsetX: vpt[4] ?? 0, offsetY: vpt[5] ?? 0 })
}

function updateGridBackground() {
  if (!wrapper.value || !canvasStore.grid.showGrid || !canvas) {
    if (wrapper.value) {
      wrapper.value.style.backgroundImage = ''
      wrapper.value.style.backgroundSize = ''
      wrapper.value.style.backgroundPosition = ''
    }
    return
  }
  const zoom = canvas.getZoom()
  const size = Math.max(canvasStore.grid.size * zoom, 1)
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const color = 'rgba(99,102,241,0.16)'
  wrapper.value.style.backgroundImage = `linear-gradient(0deg, ${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`
  wrapper.value.style.backgroundSize = `${size}px ${size}px`
  wrapper.value.style.backgroundPosition = `${((vpt[4] ?? 0) % size + size) % size}px ${((vpt[5] ?? 0) % size + size) % size}px`
}

function drawGuides() {
  const ctx = (canvas as fabric.Canvas & {contextTop?: CanvasRenderingContext2D}).contextTop
  if (!ctx) return
  canvas.clearContext(ctx)
  if (!canvasStore.grid.showGuides) return
  const width = canvas.getWidth()
  const height = canvas.getHeight()
  ctx.save()
  ctx.strokeStyle = 'rgba(99,102,241,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height)
  ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2)
  ctx.stroke()
  ctx.restore()
}

function onMouseMove(e: MouseEvent) {
  if (isPanning && isDragging) {
    const vpt = canvas.viewportTransform!
    const zoom = canvas.getZoom()
    vpt[4] += (e.clientX - lastPos.x) * zoom
    vpt[5] += (e.clientY - lastPos.y) * zoom
    lastPos = {x: e.clientX, y: e.clientY}
    canvas.requestRenderAll()
    syncViewToStore()
    updateGridBackground()
    return
  }
  if (isSelecting && selectionRect) {
    const pointer = canvas.getPointer(e as unknown as MouseEvent)
    const left = Math.min(selectionStart.x, pointer.x)
    const top = Math.min(selectionStart.y, pointer.y)
    selectionRect.set({ left, top, width: Math.abs(pointer.x - selectionStart.x), height: Math.abs(pointer.y - selectionStart.y) })
    selectionRect.setCoords()
    canvas.requestRenderAll()
  }
}

function onMouseUp(e?: MouseEvent) {
  if (isPanning) { isDragging = false; canvas.defaultCursor = 'grab'; return }
  if (isSelecting && selectionRect) {
    const nativeEvent = e ?? (event as unknown as MouseEvent)
    const pointer = canvas.getPointer(nativeEvent as unknown as MouseEvent)
    const left = Math.min(selectionStart.x, pointer.x)
    const top = Math.min(selectionStart.y, pointer.y)
    const width = Math.abs(pointer.x - selectionStart.x)
    const height = Math.abs(pointer.y - selectionStart.y)
    canvas.remove(selectionRect)
    selectionRect = null
    isSelecting = false
    canvas.selection = true
    if (width > 5 && height > 5) {
      const selectionArea = new fabric.Rect({ left, top, width, height, absolutePositioned: true })
      const objects = canvas.getObjects().filter(obj => {
        if (obj === selectionArea) return false
        return obj.intersectsWithObject(selectionArea) || obj.isContainedWithinObject(selectionArea) || selectionArea.isContainedWithinObject(obj)
      })
      if (objects.length === 1) {
        canvas.setActiveObject(objects[0])
      } else if (objects.length > 1) {
        objects.forEach(obj => obj.setCoords())
        const selection = new fabric.ActiveSelection(objects, { canvas: canvas })
        selection.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true })
        canvas.setActiveObject(selection)
      }
      updateSelection()
    }
    canvas.requestRenderAll()
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  if (!canvas) return
  const type = e.dataTransfer?.getData('shape') as ElementType | undefined
  if (!type) return
  const pointer = canvas.getPointer(e as unknown as MouseEvent)
  if (type === 'image') {
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = 'image/png,image/jpeg'
    picker.onchange = () => {
      const file = picker.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        const src = ev.target?.result as string
        new ElementRegistry.image(canvas, pointer.x, pointer.y, {src})
        snapshot()
      }
      reader.readAsDataURL(file)
    }
    picker.click()
    return
  }
  new ElementRegistry[type](canvas, pointer.x, pointer.y)
  canvas.requestRenderAll()
}

let zoomHideTimer: number | null = null

function handleWheel(opt: fabric.IEvent<WheelEvent>) {
  const event = opt.e
  if (!(event.ctrlKey || event.metaKey) || !canvas) return
  event.preventDefault()
  event.stopPropagation()
  const graphIds = graphs.value.map((g: any) => g.id).filter(Boolean)
  if (graphIds.length > 0) {
    movingGraphIds.value = new Set(graphIds)
    if (zoomHideTimer) clearTimeout(zoomHideTimer)
    zoomHideTimer = window.setTimeout(() => { movingGraphIds.value = new Set(); updateGraphs(); zoomHideTimer = null }, 150)
  }
  const currentZoom = canvas.getZoom()
  const zoomFactor = Math.pow(1.1, -event.deltaY / 100)
  const desiredZoom = Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, currentZoom * zoomFactor))
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const current = {zoom: currentZoom, offsetX: vpt[4] ?? 0, offsetY: vpt[5] ?? 0}
  const pointer = canvas.getPointer(event)
  const screenPoint = { x: pointer.x * currentZoom + current.offsetX, y: pointer.y * currentZoom + current.offsetY }
  const next = zoomToPointTransform(current, screenPoint, desiredZoom)
  canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), next.zoom)
  const nextVpt = canvas.viewportTransform!
  nextVpt[4] = next.offsetX
  nextVpt[5] = next.offsetY
  canvas.requestRenderAll()
  syncViewToStore()
  updateGridBackground()
}

function handleObjectMoving(e: fabric.IEvent<Event>) {
  if (!canvasStore.grid.snapToGrid) return
  const grid = canvasStore.grid.size
  const snapObject = (obj: fabric.Object) => {
    obj.set({ left: Math.round((obj.left ?? 0) / grid) * grid, top: Math.round((obj.top ?? 0) / grid) * grid })
    obj.setCoords()
  }
  const target = e.target
  if (!target) return
  if (target.type === 'activeSelection') (target as fabric.ActiveSelection).forEachObject(snapObject)
  else snapObject(target)
}

function handleKey(e: KeyboardEvent) {
  if (!canvas || e.code === 'Space') return
  const mod = e.ctrlKey || e.metaKey
  const shift = e.shiftKey
  if (e.code === 'Delete') { deleteSelection(); e.preventDefault(); return }
  if (e.code === 'Escape') {
    if (isSelecting && selectionRect) cancelSelection()
    else { canvas.discardActiveObject(); updateSelection() }
    e.preventDefault(); return
  }
  if (mod && e.code === 'KeyC') { copySelection(); e.preventDefault(); return }
  if (mod && e.code === 'KeyV') { pasteClipboard(); e.preventDefault(); return }
  if (mod && !shift && e.code === 'KeyZ') {
    if (undoStack.length > 1) { const cur = undoStack.pop()!; redoStack.push(cur); loadState(JSON.parse(undoStack[undoStack.length - 1])) }
    e.preventDefault(); return
  }
  if ((mod && shift && e.code === 'KeyZ') || (mod && e.code === 'KeyY')) {
    if (redoStack.length) { const next = redoStack.pop()!; undoStack.push(next); loadState(JSON.parse(next)) }
    e.preventDefault()
  }
}

function applyViewFromStore(view: {zoom: number; offsetX: number; offsetY: number}) {
  if (!canvas) return
  applyingViewFromStore = true
  canvas.setViewportTransform([view.zoom, 0, 0, view.zoom, view.offsetX, view.offsetY])
  canvas.requestRenderAll()
  applyingViewFromStore = false
  updateGridBackground()
  drawGuides()
}

onMounted(() => {
  canvas = new fabric.Canvas(cnv.value!, {
    selection: true,
    selectionColor: 'rgba(99, 102, 241, 0.1)',
    selectionBorderColor: 'rgba(99, 102, 241, 0.6)',
    selectionLineWidth: 2
  })
  setCanvas(canvas)
  registerHistoryControls(() => { undoStack.length = 0; redoStack.length = 0; snapshot() })
  applyViewFromStore(canvasStore.view)
  canvasStore.setViewportSize(canvas.getWidth(), canvas.getHeight())

  resizeObserver = new ResizeObserver(entries => {
    const rect = entries[0].contentRect
    canvas.setDimensions({width: rect.width, height: rect.height})
    canvasStore.setViewportSize(rect.width, rect.height)
    updateGridBackground(); drawGuides(); refreshInlinePosition()
  })
  resizeObserver.observe(wrapper.value!)

  canvas.on('selection:created', updateSelection)
  canvas.on('selection:updated', updateSelection)
  canvas.on('selection:cleared', updateSelection)
  canvas.on('object:added', snapshot)
  canvas.on('object:modified', snapshot)
  canvas.on('object:removed', snapshot)
  canvas.on('object:added', updateGraphs)
  canvas.on('object:modified', updateGraphs)
  canvas.on('object:removed', updateGraphs)
  canvas.on('object:moving', handleObjectMoving)
  canvas.on('object:moving', (e: fabric.IEvent<Event>) => {
    const obj = e.target as any
    if (obj?.elementType === 'time-graph' && obj.id) movingGraphIds.value = new Set([...movingGraphIds.value, obj.id])
  })
  canvas.on('object:scaling', (e: fabric.IEvent<Event>) => {
    const obj = e.target as any
    if (obj?.elementType === 'time-graph' && obj.id) movingGraphIds.value = new Set([...movingGraphIds.value, obj.id])
  })
  canvas.on('object:modified', () => { movingGraphIds.value = new Set(); updateGraphs() })
  canvas.on('mouse:up', () => { if (movingGraphIds.value.size > 0) { movingGraphIds.value = new Set(); updateGraphs() } })
  canvas.on('mouse:wheel', handleWheel)
  canvas.on('after:render', () => { updateGridBackground(); drawGuides(); refreshInlinePosition(); graphsVersion.value++ })
  canvas.on('element:edit-number', (e: any) => { openInlineEditor(e.target) })
  canvas.on('element:output', (e: any) => {
    const el = e.target
    if (!el?.bindings?.outputs) return
    const path = el.bindings.outputs[e.name]
    if (!path) return
    const [root, section, ...rest] = path.split('.')
    const name = rest.join('.')
    if (!name) return
    let payload: Record<string, any> = {}
    if (root === 'outputs') {
      if (section === 'inputs') payload = { inputs: { [name]: e.value } }
      else if (section === 'global_inputs') payload = { global_inputs: { [name]: e.value } }
    } else if (root === 'plant_outputs') {
      if (section === 'inputs') payload = { plant_inputs: { [name]: e.value } }
      else if (section === 'global_inputs') payload = { plant_inputs: { [name]: e.value } }
    }
    if (Object.keys(payload).length > 0) sessionStore.sendInputs(payload).catch(console.error)
  })

  snapshot(); updateGraphs(); updateSelection()
  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
  window.addEventListener('keydown', handleKey)
})

onBeforeUnmount(() => {
  stopRuntime()
  window.removeEventListener('keydown', onSpaceDown)
  window.removeEventListener('keyup', onSpaceUp)
  window.removeEventListener('keydown', handleKey)
  resizeObserver?.disconnect()
  canvas.dispose()
})

watch(() => ({...canvasStore.view}), view => { if (!canvas) return; applyViewFromStore(view) })
watch(() => canvasStore.grid.showGrid, updateGridBackground)
watch(() => canvasStore.grid.size, updateGridBackground)
watch(() => canvasStore.grid.showGuides, () => drawGuides())

// ========== PAGE SERIALIZATION ==========
function serializePage() {
  if (!canvas) return null
  return canvas.toJSON(['id', 'customProps', 'elementType', 'bindings', 'meta'])
}

function loadPage(canvasJson: any | null, view?: { zoom: number; offsetX: number; offsetY: number } | null) {
  if (!canvas) return
  canvas.clear()
  undoStack.length = 0
  redoStack.length = 0
  canvas.off('object:added', snapshot)

  if (canvasJson?.objects?.length) {
    for (const obj of canvasJson.objects) {
      const type = obj.elementType
      if (!type) continue
      if (type === 'image') {
        fabric.util.enlivenObjects([obj], (objs: fabric.Object[]) => {
          const img = objs[0]
          if (!img) return
          img.set({ selectable: true, evented: true })
          canvas.add(img)
          canvas.requestRenderAll()
        }, 'fabric')
        continue
      }
      const Ctor = ElementRegistry[type as ElementType]
      if (!Ctor) continue
      const el = new Ctor(canvas, obj.left ?? 0, obj.top ?? 0, obj.customProps ?? {})
      el.id = obj.id || crypto.randomUUID()
      const bindings = obj.bindingsData ?? obj.bindings ?? { inputs: {}, outputs: {} }
      if (typeof (el as any).setBindings === 'function') (el as any).setBindings(bindings)
      el.set({
        scaleX: obj.scaleX ?? 1, scaleY: obj.scaleY ?? 1,
        angle: obj.angle ?? 0, flipX: obj.flipX ?? false, flipY: obj.flipY ?? false,
        hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true,
      })
      el.setCoords()
      ;(el as any).updateFromProps?.()
    }
  }

  canvas.on('object:added', snapshot)

  const allObjects = canvas.getObjects()
  if (allObjects.length > 0) {
    const warmup = new fabric.ActiveSelection(allObjects, { canvas })
    canvas.setActiveObject(warmup)
    canvas.discardActiveObject()
  }

  canvas.requestRenderAll()
  updateGraphs()
  updateSelection()
  snapshot()
  if (view) canvasStore.setViewportTransform(view)
}

defineExpose({ serializePage, loadPage })
// ========== END PAGE SERIALIZATION ==========
</script>
