<template>
  <div ref="wrap" class="flex-1 h-full min-w-0 relative overflow-hidden">
    <canvas ref="cnv" class="block w-full h-full"/>

    <!-- inline number editor -->
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
        :key="g.id"
        :yMax="g.customProps?.yMax ?? 100"
        :yStep="g.customProps?.yStep ?? 20"
        :timeStep="g.customProps?.timeStep ?? 1"
        :timePoints="g.customProps?.timePoints ?? 20"
        :value="getGraphValue(g)"
        :isRuntime="true"
        :style="getGraphStyle(g)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, onMounted, watch } from 'vue'
import { fabric } from 'fabric'
import { setCanvas } from '@/composables/useCanvas'
import { useHmiRuntime, type HmiFile } from '@/runtime/useHmiRuntime'
import GraphTimeSeries from './GraphTimeSeries.vue'

const props = defineProps<{ hmi: HmiFile | null }>()

const wrap = shallowRef<HTMLElement>()
const cnv = shallowRef<HTMLCanvasElement>()
const graphs = ref<any[]>([])
const inlineInput = ref<HTMLInputElement>()

const inlineEditor = ref({
  visible: false,
  raw: '',
  style: {} as Record<string, string>,
  target: null as any,
})

let _canvas: fabric.Canvas | null = null

function calcInlineStyle(element: any): Record<string, string> {
  if (!_canvas || !cnv.value || !wrap.value) return {}

  const zoom = _canvas.getZoom()
  const vpt = _canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
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
  const wrapRect = wrap.value.getBoundingClientRect()
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
  if (!wrap.value || !_canvas) return

  inlineEditor.value = {
    visible: true,
    raw: String(element.customProps.value),
    style: calcInlineStyle(element),
    target: element,
  }

  element.setEditing?.(true)
  setTimeout(() => {
    inlineInput.value?.focus()
    inlineInput.value?.select()
  }, 0)
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

function getGraphStyle(obj: any) {
  return {
    position: 'absolute',
    left: obj.left + 'px',
    top: obj.top + 'px',
    width: obj.width * (obj.scaleX ?? 1) + 'px',
    height: obj.height * (obj.scaleY ?? 1) + 'px',
  }
}

function getGraphValue(g: any): number {
  return typeof g.getCurrentValue === 'function' ? g.getCurrentValue() : 0
}

function updateGraphs(canvas: fabric.Canvas) {
  graphs.value = canvas.getObjects().filter((o: any) => o.elementType === 'time-graph')
}

const runtime = shallowRef<ReturnType<typeof useHmiRuntime>>()

onMounted(() => {
  const canvas = new fabric.Canvas(cnv.value!, { selection: false })
  _canvas = canvas
  setCanvas(canvas)

  const ro = new ResizeObserver(([entry]) => {
    canvas.setDimensions({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    })
  })
  wrap.value && ro.observe(wrap.value)

  canvas.on('object:added', () => updateGraphs(canvas))
  canvas.on('object:removed', () => updateGraphs(canvas))
  canvas.on('after:render', () => refreshInlinePosition())
  canvas.on('element:edit-number', (e: any) => openInlineEditor(e.target))

  runtime.value = useHmiRuntime(canvas)
  if (props.hmi) runtime.value.loadHmi(props.hmi)
})

watch(
  () => props.hmi,
  (file) => {
    if (file && runtime.value) {
      cancelInline()
      runtime.value.loadHmi(file)
    }
  }
)
</script>
