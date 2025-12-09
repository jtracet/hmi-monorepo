<template>
  <div
      ref="wrapper"
      class="relative flex-1 h-full min-w-0 overflow-hidden"
      @dragover.prevent
      @drop="handleDrop"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
  >
    <canvas ref="cnv" class="block w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {fabric} from 'fabric'
import {ElementRegistry} from '../elements'
import type {ElementType} from '../elements'
import {setCanvas} from '../composables/useCanvas'
import {useCanvasStore} from '../store/canvas'
import {DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, zoomToPointTransform} from '../utils/zoom'

const wrapper = ref<HTMLElement>()
const cnv = ref<HTMLCanvasElement>()
const canvasStore = useCanvasStore()

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

function updateSelection() {
    if (!canvas) return
    const active = canvas.getActiveObjects()
    canvasStore.setSelection(active)
}

function snapshot() {
    undoStack.push(
        JSON.stringify(canvas.toJSON(['id', 'customProps', 'elementType', 'bindings', 'meta']))
    )
    if (undoStack.length > 50) undoStack.shift()
    redoStack.length = 0
}

function loadState(json: any) {
    canvas.clear()
    fabric.util.enlivenObjects(json.objects ?? [], (objs: fabric.Object[]) => {
        objs.forEach(obj => canvas.add(obj))
        canvas.renderAll()
        updateSelection()
    }, 'fabric')
}

function copySelection() {
    clipboard = canvas.getActiveObjects().map(o => o)
}

function pasteClipboard() {
    clipboard.forEach(source => {
        source.clone((clone: fabric.Object | null) => {
            if (!clone) return
            ;(clone as any).id = crypto.randomUUID()
            clone.set({
                left: (clone.left ?? 0) + 20,
                top: (clone.top ?? 0) + 20,
            })
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
            onComplete: () => {
                canvas.remove(obj)
                snapshot()
            },
        })
    })
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    updateSelection()
}

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
    if (isPanning) {
        isDragging = true
        canvas.defaultCursor = 'grabbing'
        lastPos = {x: e.clientX, y: e.clientY}
        e.preventDefault()
        return
    }
    
    // ЕСЛИ УЖЕ ЕСТЬ ВЫБРАННЫЕ ОБЪЕКТЫ - НЕ НАЧИНАЕМ ВЫДЕЛЕНИЕ
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects && activeObjects.length > 0) {
        return
    }
    
    // Если не зажат Space и не панорамируем - начинаем выделение
    const pointer = canvas.getPointer(e as unknown as MouseEvent)
    selectionStart = { x: pointer.x, y: pointer.y }
    isSelecting = true
    
    // Создаем прямоугольник выделения
    selectionRect = new fabric.Rect({
        left: selectionStart.x,
        top: selectionStart.y,
        width: 0,
        height: 0,
        fill: 'rgba(99, 102, 241, 0.1)',
        stroke: 'rgba(99, 102, 241, 0.6)',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        absolutePositioned: true
    })
    
    canvas.add(selectionRect)
    canvas.selection = false // временно отключаем стандартное выделение
}

function syncViewToStore() {
    if (!canvas || applyingViewFromStore) return
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    canvasStore.setViewportTransform({
        zoom: canvas.getZoom(),
        offsetX: vpt[4] ?? 0,
        offsetY: vpt[5] ?? 0,
    })
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
    const offsetX = ((vpt[4] ?? 0) % size + size) % size
    const offsetY = ((vpt[5] ?? 0) % size + size) % size
    wrapper.value.style.backgroundPosition = `${offsetX}px ${offsetY}px`
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
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    ctx.restore()
}

function onMouseMove(e: MouseEvent) {
    if (isPanning && isDragging) {
        const vpt = canvas.viewportTransform!
        const dx = e.clientX - lastPos.x
        const dy = e.clientY - lastPos.y
        const zoom = canvas.getZoom()
        vpt[4] += dx * zoom
        vpt[5] += dy * zoom
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
        const width = Math.abs(pointer.x - selectionStart.x)
        const height = Math.abs(pointer.y - selectionStart.y)
        
        selectionRect.set({
            left,
            top,
            width,
            height
        })
        selectionRect.setCoords()
        canvas.requestRenderAll()
    }
}

function onMouseUp() {
    if (isPanning) {
        isDragging = false
        canvas.defaultCursor = 'grab'
        return
    }
    
    if (isSelecting && selectionRect) {
        // Завершаем выделение
        const pointer = canvas.getPointer(event as unknown as MouseEvent)
        const left = Math.min(selectionStart.x, pointer.x)
        const top = Math.min(selectionStart.y, pointer.y)
        const width = Math.abs(pointer.x - selectionStart.x)
        const height = Math.abs(pointer.y - selectionStart.y)
        
        // Если область выделения достаточно большая
        if (width > 5 && height > 5) {
            const selectionArea = new fabric.Rect({
                left,
                top,
                width,
                height,
                absolutePositioned: true
            })
            
            // Выделяем объекты, попадающие в область
            const objects = canvas.getObjects().filter(obj => {
                if (obj === selectionRect || obj === selectionArea) return false
                return obj.intersectsWithObject(selectionArea) || 
                       obj.isContainedWithinObject(selectionArea) ||
                       selectionArea.isContainedWithinObject(obj)
            })
            
            if (objects.length > 0) {
                const selection = new fabric.ActiveSelection(objects, { canvas: canvas })
                canvas.setActiveObject(selection)
                updateSelection()
            }
        }
        
        // Убираем прямоугольник выделения
        canvas.remove(selectionRect)
        selectionRect = null
        isSelecting = false
        canvas.selection = true // возвращаем стандартное выделение
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
                const Ctor = ElementRegistry.image
                new Ctor(canvas, pointer.x, pointer.y, {src})
                snapshot()
            }
            reader.readAsDataURL(file)
        }
        picker.click()
        return
    }

    const Ctor = ElementRegistry[type]
    new Ctor(canvas, pointer.x, pointer.y)
    canvas.requestRenderAll()
}

function handleWheel(opt: fabric.IEvent<WheelEvent>) {
    const event = opt.e
    if (!(event.ctrlKey || event.metaKey) || !canvas) return
    event.preventDefault()
    event.stopPropagation()

    const currentZoom = canvas.getZoom()
    const zoomFactor = Math.pow(1.1, -event.deltaY / 100)
    const desiredZoom = Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, currentZoom * zoomFactor))
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const current = {zoom: currentZoom, offsetX: vpt[4] ?? 0, offsetY: vpt[5] ?? 0}
    const pointer = canvas.getPointer(event)
    const screenPoint = {
        x: pointer.x * currentZoom + current.offsetX,
        y: pointer.y * currentZoom + current.offsetY,
    }
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
        const left = obj.left ?? 0
        const top = obj.top ?? 0
        obj.set({
            left: Math.round(left / grid) * grid,
            top: Math.round(top / grid) * grid,
        })
        obj.setCoords()
    }
    const target = e.target
    if (!target) return
    if (target.type === 'activeSelection') {
        ;(target as fabric.ActiveSelection).forEachObject(snapObject)
    } else {
        snapObject(target)
    }
}

function handleKey(e: KeyboardEvent) {
    if (!canvas || e.code === 'Space') return

    
    const mod = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    if (e.code === 'Delete') {
        deleteSelection()
        e.preventDefault()
        return
    }
    if (e.code === 'Escape') {
        if (isSelecting && selectionRect) {
            canvas.remove(selectionRect)
            selectionRect = null
            isSelecting = false
            canvas.selection = true
            canvas.requestRenderAll()
        } else {
            canvas.discardActiveObject()
            updateSelection()
        }
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
    applyViewFromStore(canvasStore.view)
    canvasStore.setViewportSize(canvas.getWidth(), canvas.getHeight())

    resizeObserver = new ResizeObserver(entries => {
        const rect = entries[0].contentRect
        canvas.setDimensions({width: rect.width, height: rect.height})
        canvasStore.setViewportSize(rect.width, rect.height)
        updateGridBackground()
        drawGuides()
    })
    resizeObserver.observe(wrapper.value!)

    canvas.on('selection:created', updateSelection)
    canvas.on('selection:updated', updateSelection)
    canvas.on('selection:cleared', updateSelection)
    canvas.on('object:added', snapshot)
    canvas.on('object:modified', snapshot)
    canvas.on('object:removed', snapshot)
    canvas.on('object:moving', handleObjectMoving)
    canvas.on('mouse:wheel', handleWheel)
    canvas.on('after:render', () => {
        updateGridBackground()
        drawGuides()
    })

    snapshot()
    updateSelection()

    window.addEventListener('keydown', onSpaceDown)
    window.addEventListener('keyup', onSpaceUp)
    window.addEventListener('keydown', handleKey)
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onSpaceDown)
    window.removeEventListener('keyup', onSpaceUp)
    window.removeEventListener('keydown', handleKey)
    resizeObserver?.disconnect()
    canvas.dispose()
})

watch(() => ({...canvasStore.view}), view => {
    if (!canvas) return
    applyViewFromStore(view)
})

watch(() => canvasStore.grid.showGrid, updateGridBackground)
watch(() => canvasStore.grid.size, updateGridBackground)
watch(() => canvasStore.grid.showGuides, () => drawGuides())
</script>
