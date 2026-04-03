<template>
  <div ref="wrap" class="flex-1 h-full min-w-0 relative overflow-hidden">
    <canvas ref="cnv" class="block w-full h-full"/>
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

const runtime = shallowRef<ReturnType<typeof useHmiRuntime>>()

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

onMounted(() => {
  const canvas = new fabric.Canvas(cnv.value!, { selection: false })
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

  runtime.value = useHmiRuntime(canvas)
  if (props.hmi) runtime.value.loadHmi(props.hmi)
})

watch(
  () => props.hmi,
  (file) => {
    if (file && runtime.value) {
      runtime.value.loadHmi(file)
    }
  }
)
</script>
