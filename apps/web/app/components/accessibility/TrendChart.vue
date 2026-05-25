<script setup lang="ts">
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
import { Line } from 'vue-chartjs'
import { format } from 'date-fns'
import type { Scan } from '~/types/accessiq'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{ scans: Scan[] }>()

const chartData = computed(() => {
  const sorted = [...props.scans].reverse()
  return {
    labels: sorted.map(s => s.completed_at ? format(new Date(s.completed_at), 'MMM d') : ''),
    datasets: [{
      label: 'AA Score',
      data: sorted.map(s => s.score_aa ?? 0),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      fill: true,
      tension: 0.3
    }]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { min: 0, max: 100 },
    x: { grid: { display: false } }
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="font-medium">Score trend (30 days)</h3>
    </template>
    <div class="h-32">
      <Line v-if="scans.length" :data="chartData" :options="chartOptions" />
      <p v-else class="text-sm text-muted text-center py-8">No scan history yet</p>
    </div>
  </UCard>
</template>
