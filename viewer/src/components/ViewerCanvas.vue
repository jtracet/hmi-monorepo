<template>
  <div
      ref="wrap"
      class="flex-1 h-full min-w-0 relative overflow-hidden"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
  >
    <canvas ref="cnv" class="block w-full h-full"/>
  </div>
</template>

<script setup lang="ts">
import {shallowRef, onMounted, onBeforeUnmount, watch} from 'vue'
import {fabric} from 'fabric'
import {setCanvas} from '@/composables/useCanvas'
import {useHmiRuntime, type HmiFile} from '@/runtime/useHmiRuntime'
import {useViewerCanvasStore} from '@/store/canvas'

const DEFAULT_MIN_ZOOM = 0.25
const DEFAULT_MAX_ZOOM = 4
const VIEWPORT_PADDING = 40

const props = defineProps<{ hmi: HmiFile | null }>()

const wrap = shallowRef<HTMLElement>()
const cnv = shallowRef<HTMLCanvasElement>()
const store = useViewerCanvasStore()

const runtime = shallowRef<ReturnType<typeof useHmiRuntime>>()

let canvas!: fabric.Canvas
let resizeObserver: ResizeObserver | null = null
let isPanning = false
let isDragging = false
let lastPos = {x: 0, y: 0}

function clampZoom(zoom: number) {
  return Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, zoom))
}

function syncViewToStore() {
  if (!canvas) return
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  store.setViewportTransform({
    zoom: canvas.getZoom(),
    offsetX: vpt[4] ?? 0,
    offsetY: vpt[5] ?? 0,
  })
}

function applyTransform(t: {zoom: number; offsetX: number; offsetY: number}) {
  if (!canvas) return
  canvas.setViewportTransform([t.zoom, 0, 0, t.zoom, t.offsetX, t.offsetY])
  canvas.requestRenderAll()
  store.setViewportTransform(t)
  updateGridBackground()
  drawGuides()
}

function updateGridBackground() {
  if (!wrap.value || !store.grid.showGrid || !canvas) {
    if (wrap.value) {
      wrap.value.style.backgroundImage = ''
      wrap.value.style.backgroundSize = ''
      wrap.value.style.backgroundPosition = ''
    }
    return
  }
  const zoom = canvas.getZoom()
  const size = Math.max(store.grid.size * zoom, 1)
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const color = 'rgba(99,102,241,0.16)'
  wrap.value.style.backgroundImage = `linear-gradient(0deg, ${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`
  wrap.value.style.backgroundSize = `${size}px ${size}px`
  const offsetX = ((vpt[4] ?? 0) % size + size) % size
  const offsetY = ((vpt[5] ?? 0) % size + size) % size
  wrap.value.style.backgroundPosition = `${offsetX}px ${offsetY}px`
}

function drawGuides() {
  const ctx = (canvas as fabric.Canvas & {contextTop?: CanvasRenderingContext2D}).contextTop
  if (!ctx) return
  canvas.clearContext(ctx)
  if (!store.grid.showGuides) return
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

function fitToLeftEdge() {
  if (!canvas) return
  const objects = canvas.getObjects().filter(o => o.visible)
  if (!objects.length) return

  let minLeft = Infinity
  let minTop = Infinity
  for (const obj of objects) {
    const rect = obj.getBoundingRect(true, true)
    if (rect.left < minLeft) minLeft = rect.left
    if (rect.top < minTop) minTop = rect.top
  }

  const zoom = canvas.getZoom() || 1
  applyTransform({
    zoom,
    offsetX: -minLeft * zoom + VIEWPORT_PADDING,
    offsetY: -minTop * zoom + VIEWPORT_PADDING,
  })
}

// --- Panning ---
function suppressUndo(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  if (mod && (e.code === 'KeyZ' || e.code === 'KeyY')) {
    e.preventDefault()
  }
}

function onSpaceDown(e: KeyboardEvent) {
  if (e.code !== 'Space' || isPanning) return
  isPanning = true
  canvas.defaultCursor = 'grab'
  e.preventDefault()
}

function onSpaceUp(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  isPanning = false
  isDragging = false
  canvas.defaultCursor = 'default'
  e.preventDefault()
}

function onMouseDown(e: MouseEvent) {
  if (!isPanning) return
  isDragging = true
  canvas.defaultCursor = 'grabbing'
  lastPos = {x: e.clientX, y: e.clientY}
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isPanning || !isDragging) return
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
}

function onMouseUp() {
  if (isPanning && isDragging) {
    isDragging = false
    canvas.defaultCursor = 'grab'
  }
}

// --- Zoom via Ctrl+Wheel ---
function handleWheel(opt: fabric.IEvent<WheelEvent>) {
  const event = opt.e
  if (!(event.ctrlKey || event.metaKey) || !canvas) return
  event.preventDefault()
  event.stopPropagation()

  const currentZoom = canvas.getZoom()
  const zoomFactor = Math.pow(1.1, -event.deltaY / 100)
  const desiredZoom = clampZoom(currentZoom * zoomFactor)
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const current = {zoom: currentZoom, offsetX: vpt[4] ?? 0, offsetY: vpt[5] ?? 0}
  const pointer = canvas.getPointer(event)
  const screenPoint = {
    x: pointer.x * currentZoom + current.offsetX,
    y: pointer.y * currentZoom + current.offsetY,
  }

  const nextZoom = desiredZoom
  const scale = nextZoom / (current.zoom === 0 ? 1 : current.zoom)
  const offsetX = screenPoint.x - scale * (screenPoint.x - current.offsetX)
  const offsetY = screenPoint.y - scale * (screenPoint.y - current.offsetY)

  applyTransform({zoom: nextZoom, offsetX, offsetY})
}

// --- Public zoom/grid methods exposed for TopBar ---
function zoomIn() {
  const t = store.view
  const width = store.viewportSize.width || canvas.getWidth()
  const height = store.viewportSize.height || canvas.getHeight()
  const point = {x: width / 2, y: height / 2}
  const nextZoom = clampZoom(t.zoom * 1.2)
  const scale = nextZoom / (t.zoom === 0 ? 1 : t.zoom)
  applyTransform({
    zoom: nextZoom,
    offsetX: point.x - scale * (point.x - t.offsetX),
    offsetY: point.y - scale * (point.y - t.offsetY),
  })
}

function zoomOut() {
  const t = store.view
  const width = store.viewportSize.width || canvas.getWidth()
  const height = store.viewportSize.height || canvas.getHeight()
  const point = {x: width / 2, y: height / 2}
  const nextZoom = clampZoom(t.zoom / 1.2)
  const scale = nextZoom / (t.zoom === 0 ? 1 : t.zoom)
  applyTransform({
    zoom: nextZoom,
    offsetX: point.x - scale * (point.x - t.offsetX),
    offsetY: point.y - scale * (point.y - t.offsetY),
  })
}

function zoomReset() {
  applyTransform({zoom: 1, offsetX: 0, offsetY: 0})
}

function zoomActual() {
  const t = store.view
  const width = store.viewportSize.width || canvas.getWidth()
  const height = store.viewportSize.height || canvas.getHeight()
  const point = {x: width / 2, y: height / 2}
  const nextZoom = 1
  const scale = nextZoom / (t.zoom === 0 ? 1 : t.zoom)
  applyTransform({
    zoom: nextZoom,
    offsetX: point.x - scale * (point.x - t.offsetX),
    offsetY: point.y - scale * (point.y - t.offsetY),
  })
}

function zoomFit() {
  if (!canvas) return
  const objects = canvas.getObjects().filter(o => o.visible)
  if (!objects.length) {
    applyTransform({zoom: 1, offsetX: 0, offsetY: 0})
    return
  }
  const bounds = objects.reduce((acc, obj) => {
    const rect = obj.getBoundingRect(true, true)
    return {
      left: Math.min(acc.left, rect.left),
      top: Math.min(acc.top, rect.top),
      right: Math.max(acc.right, rect.left + rect.width),
      bottom: Math.max(acc.bottom, rect.top + rect.height),
    }
  }, {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity})

  const cw = Math.max(bounds.right - bounds.left, 1)
  const ch = Math.max(bounds.bottom - bounds.top, 1)
  const vw = store.viewportSize.width || canvas.getWidth()
  const vh = store.viewportSize.height || canvas.getHeight()
  const pad = VIEWPORT_PADDING
  const zoom = clampZoom(Math.min((vw - pad * 2) / cw, (vh - pad * 2) / ch))
  const offsetX = (vw - cw * zoom) / 2 - bounds.left * zoom
  const offsetY = (vh - ch * zoom) / 2 - bounds.top * zoom
  applyTransform({zoom, offsetX, offsetY})
}

defineExpose({zoomIn, zoomOut, zoomReset, zoomActual, zoomFit})

onMounted(() => {
  canvas = new fabric.Canvas(cnv.value!, {selection: false})
  setCanvas(canvas)
  store.setViewportSize(canvas.getWidth(), canvas.getHeight())

  resizeObserver = new ResizeObserver(([entry]) => {
    canvas.setDimensions({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    })
    store.setViewportSize(entry.contentRect.width, entry.contentRect.height)
    updateGridBackground()
    drawGuides()
  })
  wrap.value && resizeObserver.observe(wrap.value)

  canvas.on('mouse:wheel', handleWheel)
  canvas.on('after:render', () => {
    updateGridBackground()
    drawGuides()
  })

  window.addEventListener('keydown', onSpaceDown)
  window.addEventListener('keyup', onSpaceUp)
  window.addEventListener('keydown', suppressUndo)

  runtime.value = useHmiRuntime(canvas)
  if (props.hmi) {
    runtime.value.loadHmi(props.hmi).then(() => fitToLeftEdge())
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onSpaceDown)
  window.removeEventListener('keyup', onSpaceUp)
  window.removeEventListener('keydown', suppressUndo)
  resizeObserver?.disconnect()
  canvas.dispose()
})

watch(
    () => props.hmi,
    (file) => {
      if (file && runtime.value) {
        runtime.value.loadHmi(file).then(() => fitToLeftEdge())
      }
    },
)

watch(() => store.grid.showGrid, updateGridBackground)
watch(() => store.grid.size, updateGridBackground)
watch(() => store.grid.showGuides, () => drawGuides())
</script>
