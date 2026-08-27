<script setup lang="ts">
import { CHART_PURPLE_COLOR } from '~/utils/chartTheme'

withDefaults(defineProps<{
  title?: string | null
  score: number | null
  emptyLabel: string
  issueSummary?: string | null
}>(), {
  title: null,
  issueSummary: null
})
</script>

<template>
  <div class="flex h-full flex-col rounded-lg border border-default bg-elevated/25 p-4 sm:p-5 shadow-none ring-0">
    <p
      v-if="title"
      class="mb-4 text-left text-sm font-semibold text-default"
    >
      {{ title }}
    </p>
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
      <AccessibilityScoreDonut
        v-if="score != null"
        :score="score"
        :ring-color="CHART_PURPLE_COLOR"
        hover-zoom
      />
      <p
        v-else
        class="max-w-xs text-center text-sm text-muted"
      >
        {{ emptyLabel }}
      </p>
      <p
        v-if="issueSummary"
        class="text-sm text-muted"
      >
        {{ issueSummary }}
      </p>
    </div>
  </div>
</template>
