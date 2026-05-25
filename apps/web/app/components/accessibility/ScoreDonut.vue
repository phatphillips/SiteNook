<script setup lang="ts">
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps<{
  score: number
  label?: string
  size?: 'sm' | 'lg'
}>()

const color = computed(() => {
  if (props.score > 80) return '#22c55e'
  if (props.score >= 60) return '#f59e0b'
  return '#ef4444'
})

const chartData = computed(() => ({
  labels: ['Score', 'Remaining'],
  datasets: [{
    data: [props.score, 100 - props.score],
    backgroundColor: [color.value, '#e5e7eb'],
    borderWidth: 0
  }]
}))

const chartOptions = {
  cutout: '75%',
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  animation: { animateRotate: true, duration: 800 }
}

const sizeClass = computed(() => props.size === 'sm' ? 'size-20' : 'size-40')
</script>

<template>
  <div class="relative inline-flex flex-col items-center" :class="sizeClass">
    <Doughnut :data="chartData" :options="chartOptions" />
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="font-bold" :class="size === 'sm' ? 'text-lg' : 'text-3xl'">{{ score }}</span>
      <span v-if="label" class="text-xs text-muted">{{ label }}</span>
    </div>
  </div>
</template>
