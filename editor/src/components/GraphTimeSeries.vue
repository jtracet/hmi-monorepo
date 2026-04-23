<template>
  <div ref="chartEl" class="graph-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  yMax: number
  yStep: number
  timeStep: number   // интервал между точками, секунды
  timePoints: number // количество точек на шкале времени
  value: number
  isRuntime: boolean
}>()

const chartEl = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let timer: number | null = null
let resizeObserver: ResizeObserver | null = null

// Накапливаемый буфер — растёт справа, максимум timePoints точек
let buffer: number[] = []

// Метки оси X: от -(N-1) до 0, фиксированные
function buildXLabels(): string[] {
  return Array.from({ length: props.timePoints }, (_, i) => String(i - (props.timePoints - 1)))
}

// Данные для серии: буфер выровнен по правому краю, левая часть — null (нет данных)
function buildSeriesData(): (number | null)[] {
  const total = props.timePoints
  const len = buffer.length
  const result: (number | null)[] = Array(total).fill(null)
  // заполняем с правого края
  for (let i = 0; i < len; i++) {
    result[total - len + i] = buffer[i]
  }
  return result
}

function buildOption() {
  const hasData = props.isRuntime && buffer.length > 0
  return {
    backgroundColor: '#0f172a',
    animation: false,
    grid: { left: 55, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: buildXLabels(),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#94a3b8' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
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
      showSymbol: hasData,
      symbol: hasData ? 'circle' : 'none',
      symbolSize: 5,
      smooth: false,
      lineStyle: { width: hasData ? 2 : 0, color: '#22c55e' },
      itemStyle: { color: '#22c55e' },
      connectNulls: false,
      data: buildSeriesData(),
    }],
  }
}

function addPoint() {
  buffer.push(props.value)
  if (buffer.length > props.timePoints) buffer.shift()
  chart?.setOption({
    series: [{
      data: buildSeriesData(),
      showSymbol: true,
      symbol: 'circle',
      lineStyle: { width: 2 },
    }]
  })
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

function reset() {
  buffer = []
  chart?.setOption(buildOption())
}

watch(() => props.isRuntime, (val) => {
  if (val) {
    reset()
    startTimer()
  } else {
    stopTimer()
    reset()
  }
})

// при изменении шкал — перестраиваем опции (оси), данные не трогаем
watch(() => [props.yMax, props.yStep], () => {
  chart?.setOption({
    yAxis: { max: props.yMax, interval: props.yStep }
  })
})

// при изменении количества точек — полный сброс
watch(() => props.timePoints, () => {
  reset()
  chart?.setOption({ xAxis: { data: buildXLabels() } })
  if (props.isRuntime) {
    stopTimer()
    startTimer()
  }
})

// при изменении шага времени — перезапускаем таймер
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

  // ResizeObserver следит за размером контейнера (меняется при zoom/scale через CSS)
  resizeObserver = new ResizeObserver(() => {
    chart?.resize()
  })
  resizeObserver.observe(chartEl.value)

  window.addEventListener('resize', resize)
})

function resize() { chart?.resize() }

onBeforeUnmount(() => {
  stopTimer()
  resizeObserver?.disconnect()
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
