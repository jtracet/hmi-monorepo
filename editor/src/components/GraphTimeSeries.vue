<template>
  <div ref="chartEl" class="graph-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const chartEl = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null
let timer: number | null = null

const MAX_POINTS = 10

// Меняем здесь - теперь от -9 до 0
const categories = Array.from({ length: MAX_POINTS }, (_, i) => i - 9)
// или можно так: const categories = [-9, -8, -7, -6, -5, -4, -3, -2, -1, 0]

const data: number[] = Array(MAX_POINTS).fill(0)

function createOption() {
  return {
    backgroundColor: '#0f172a',

    animation: false,

    grid: {
      left: 60,
      right: 20,
      top: 30,
      bottom: 40
    },

    tooltip: { trigger: 'axis' },

    xAxis: {
      type: 'category',

      data: categories,

      boundaryGap: false,

      axisLine: {
        lineStyle: { color: '#94a3b8' }
      },

      axisTick: {
        show: true
      },

      axisLabel: {
        color: '#94a3b8'
      },

      splitLine: {
        show: true,
        lineStyle: {
          color: '#1e293b'
        }
      }
    },

    yAxis: {
      type: 'value',

      min: 0,
      max: 100,

      axisLine: {
        lineStyle: { color: '#94a3b8' }
      },

      axisTick: {
        show: true
      },

      axisLabel: {
        color: '#94a3b8'
      },

      splitLine: {
        show: true,
        lineStyle: {
          color: '#1e293b'
        }
      }
    },

    series: [
      {
        name: 'Signal',

        type: 'line',

        showSymbol: true,

        symbol: 'circle',

        symbolSize: 6,

        smooth: false,

        lineStyle: {
          width: 2,
          color: '#22c55e'
        },

        data
      }
    ]
  }
}

function addPoint() {
  data.shift()
  // Генерируем случайное число от 0 до 100
  const randomValue = Math.floor(Math.random() * 101)
  data.push(randomValue)

  chart?.setOption({
    series: [{ data }]
  })
}

onMounted(() => {
  if (!chartEl.value) return

  chart = echarts.init(chartEl.value)

  chart.setOption(createOption())

  timer = window.setInterval(addPoint, 1000)

  window.addEventListener('resize', resize)
})

function resize() {
  chart?.resize()
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)

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