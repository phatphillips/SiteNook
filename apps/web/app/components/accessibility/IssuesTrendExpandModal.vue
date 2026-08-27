<script setup lang="ts">
import type { Scan } from '~/types/sitenook'
import type { ScoreTrendExpandMode } from '~/utils/scoreTrendExpand'
import SharedMetricTrendExpandModal from '~/components/shared/MetricTrendExpandModal.vue'

withDefaults(defineProps<{
  mode: ScoreTrendExpandMode
  scans: Scan[]
  loading?: boolean
  title?: string
}>(), {
  loading: false,
  title: undefined
})

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <SharedMetricTrendExpandModal
    v-model:open="open"
    kind="open_issues"
    :mode="mode"
    :scans="scans"
    :loading="loading"
    :title="title"
  />
</template>
