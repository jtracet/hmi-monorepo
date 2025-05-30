<template>
  <div
      ref="wrapper"
      class="flex-1 h-full min-w-0 relative overflow-hidden"
      @dragover.prevent
      @drop="handleDrop"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
  >
    <canvas ref="cnv" class="block w-full h-full"/>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { fabric } from 'fabric'
import { ElementRegistry } from '../elements'
import type { ElementType } from '../elements'
import { setCanvas } from '../composables/useCanvas'

const emit = defineEmits<{ (e: 'update:selectedObject', obj: fabric.Object | null): void }>()
const wrapper = ref<HTMLElement>()
const cnv = ref<HTMLCanvasElement>()
let canvas!: fabric.Canvas

let isPanning = false
let isDragging = false
let lastPos = { x: 0, y: 0 }

function onSpaceDown(e: KeyboardEvent) {
  if (e.code !== 'Space' || isPanning) return
  isPanning = true
  canvas.selection = false
  canvas.defaultCursor = 'grab'
  e.preventDefault()
}

function onSpaceUp(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  isPanning = false
  isDragging = false
  canvas.selection = true
  canvas.defaultCursor = 'default'
  e.preventDefault()
}

function onMouseDown(e: MouseEvent) {
  if (!isPanning) return
  isDragging = true
  canvas.defaultCursor = 'grabbing'
  lastPos = { x: e.clientX, y: e.clientY }
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isPanning || !isDragging) return
  const vpt = canvas.viewportTransform!
  const dx = e.clientX - lastPos.x
  const dy = e.clientY - lastPos.y
  vpt[4] += dx
  vpt[5] += dy
  canvas.requestRenderAll()
  lastPos = { x: e.clientX, y: e.clientY }
}

function onMouseUp() {
  if (!isPanning) return
  isDragging = false
  canvas.defaultCursor = 'grab'
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
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
        const Ctor = ElementRegistry.image
        new Ctor(canvas, pointer.x, pointer.y, { src })
        snapshot()
      }
      reader.readAsDataURL(file)
    }
    picker.click()
    return
  }

  const Ctor = ElementRegistry[type]
  new Ctor(canvas, pointer.x, pointer.y)
}

const undoStack: string[] = []
const redoStack: string[] = []

function snapshot() {
  undoStack.push(
      JSON.stringify(canvas.toJSON(['id', 'customProps', 'elementType', 'bindings', 'meta']))
  )
  if (undoStack.length > 50) undoStack.shift()
  redoStack.length = 0
}

function loadState(json: any) {
  canvas.clear()
  fabric.util.enlivenObjects(json.objects, objs => {
    objs.forEach(o => canvas.add(o))
    canvas.renderAll()
  })
}

let clipboard: fabric.Object[] = []

function copySelection() {
  clipboard = canvas.getActiveObjects().map(o => o)
}

function pasteClipboard() {
  clipboard.forEach(source => {
    source.clone(clone => {
      clone!.set({
        id: crypto.randomUUID(),
        left: (clone!.left ?? 0) + 20,
        top: (clone!.top ?? 0) + 20
      })
      canvas.add(clone!)
      canvas.setActiveObject(clone!)
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
      onComplete: () => {
        canvas.remove(obj)
        snapshot()
      }
    })
  })
  canvas.discardActiveObject()
}

function handleKey(e: KeyboardEvent) {
  if (!canvas || e.code === 'Space') return
  const mod = e.ctrlKey || e.metaKey
  const shift = e.shiftKey

  if (e.code === 'Delete' || e.code === 'Backspace') {
    deleteSelection()
    e.preventDefault()
    return
  }
  if (mod && e.code === 'KeyC') {
    copySelection()
    e.preventDefault()
    return
  }
  if (mod && e.code === 'KeyV') {
    pasteClipboard()
    e.preventDefault()
    return
  }
  if (mod && !shift && e.code === 'KeyZ') {
    if (undoStack.length > 1) {
      const current = undoStack.pop()!
      redoStack.push(current)
      loadState(JSON.parse(undoStack[undoStack.length - 1]))
    }
    e.preventDefault()
    return
  }
  if ((mod && shift && e.code === 'KeyZ') || (mod && e.code === 'KeyY')) {
    if (redoStack.length) {
      const next = redoStack.pop()!
      undoStack.push(next)
      loadState(JSON.parse(next))
    }
    e.preventDefault()
  }
}

onMounted(() => {
  canvas = new fabric.Canvas(cnv.value!, { selection: true })
  setCanvas(canvas)
  const ro = new ResizeObserver(entries => {
    const r = entries[0].contentRect
    canvas.setDimensions({ width: r.width, height: r.height })
  })
  ro.observe(wrapper.value!)
  canvas.on('selection:created', e => emit('update:selectedObject', e.selected?.[0] ?? null))
  canvas.on('selection:updated', e => emit('update:selectedObject', e.selected?.[0] ?? null))
  canvas.on('selection:cleared', () => emit('update:selectedObject', null))
  canvas.on('object:added', snapshot)
  canvas.on('object:modified', snapshot)
  canvas.on('object:removed', snapshot)
  snapshot()
  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
  window.addEventListener('keydown', handleKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onSpaceDown)
  window.removeEventListener('keyup', onSpaceUp)
  window.removeEventListener('keydown', handleKey)
})
</script>
