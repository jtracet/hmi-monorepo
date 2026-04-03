<template>
  <div ref="chartEl" class="graph-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  yMax: number
  yStep: number
  timeStep: number
  value: number
  isRuntime: boolean
}>()

const chartEl = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let timer: number | null = null

const MAX_POINTS = 20
const timestamps: number[] = []
const data: (number | null)[] = []

function buildOption() {
  return {
    backgroundColor: '#0f172a',
    animation: false,
    grid: { left: 55, right: 20, top: 20, bottom: 35 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: timestamps.map(t => {
        const d = new Date(t)
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
      }),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#94a3b8' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 30 },
      splitLine: { show: true, lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: props.yMax,
      interval: props.yStep,
      axisLine: { lineStyle: { color: '#94a3b8' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { show: true, lineStyle: { color: '#1e293b' } },
    },
    series: [{
      name: 'value',
      type: 'line',
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 5,
      smooth: false,
      lineStyle: { width: 2, color: '#22c55e' },
      itemStyle: { color: '#22c55e' },
      data: [...data],
    }],
  }
}

function addPoint() {
  const now = Date.now()
  timestamps.push(now)
  data.push(props.value)

  if (timestamps.length > MAX_POINTS) {
    timestamps.shift()
    data.shift()
  }

  chart?.setOption(buildOption())
}

function startTimer() {
  if (timer) return
  timer = window.setInterval(addPoint, props.timeStep * 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function resetData() {
  timestamps.length = 0
  data.length = 0
  chart?.setOption(buildOption())
}

watch(() => props.isRuntime, (val) => {
  if (val) {
    resetData()
    startTimer()
  } else {
    stopTimer()
    resetData()
  }
})

watch(() => [props.yMax, props.yStep], () => {
  chart?.setOption(buildOption())
})

watch(() => props.timeStep, () => {
  if (props.isRuntime) {
    stopTimer()
    startTimer()
  }
})

onMounted(() => {
  if (!chartEl.value) return
  chart = echarts.init(chartEl.value)
  chart.setOption(buildOption())

  if (props.isRuntime) {
    startTimer()
  }

  window.addEventListener('resize', resize)
})

function resize() { chart?.resize() }

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('resize', resize)
  chart?.dispose()
})
</script>

<style scoped>
.graph-container {
  width: 100%;
  height: 100%;
}
</style>
