<script setup lang="ts">
import type { ScoreBreakdownModel } from '~/utils/scoreBreakdown'
import { progressScoreSlices } from '~/utils/scoreBreakdown'

const props = withDefaults(defineProps<{
  title?: string | null
  score: number | null
  emptyLabel: string
  issueSummary?: string | null
  /** Optional deep-link shown in the breakdown modal footer. */
  ctaTo?: string | null
  ctaLabel?: string | null
}>(), {
  title: null,
  issueSummary: null,
  ctaTo: null,
  ctaLabel: null
})

const breakdownOpen = ref(false)
const { chartStyle } = useDonutChartStyle()

const breakdownModel = computed((): ScoreBreakdownModel | null => {
  if (props.score == null) return null
  const title = props.title || 'Average score'
  return {
    title: `${title} breakdown`,
    description: 'Workspace average across sites with a completed score in this area.',
    score: props.score,
    caption: title,
    scoreExplainer:
      'This is the mean of completed site scores in this workspace for this area. Open a site overview for the detailed scoring model and issue list.',
    slices: progressScoreSlices(props.score, {
      scoreLabel: 'Average score',
      remainderLabel: 'Remaining to 100'
    }),
    rows: [
      {
        id: 'average',
        label: title,
        value: props.score,
        color: 'var(--donut-segment-1)',
        score: props.score,
        detail: props.issueSummary || 'Mean of site scores in this workspace'
      },
      {
        id: 'remaining',
        label: 'Remaining to 100',
        value: Math.max(0, 100 - props.score),
        color: 'var(--donut-segment-5)',
        detail: 'Headroom before a perfect average'
      }
    ].filter(row => row.value > 0),
    footnote: 'Open a site overview for per-site score breakdowns and issue lists.',
    ctaLabel: props.ctaLabel || undefined,
    ctaTo: props.ctaTo || undefined
  }
})
</script>

<template>
  <div class="relative flex h-full flex-col rounded-lg border border-default bg-elevated p-4 sm:p-5 shadow-none ring-0">
    <div class="mb-4 flex items-start justify-between gap-2">
      <p
        v-if="title"
        class="min-w-0 text-left text-sm font-semibold text-default"
      >
        {{ title }}
      </p>
      <span
        v-else
        class="min-w-0"
        aria-hidden="true"
      />
      <ScoreDonutMenu
        :breakdown-disabled="score == null"
        @breakdown="breakdownOpen = true"
      />
    </div>
    <div class="flex flex-1 flex-col items-center justify-center gap-2">
      <ScoreDonutButton
        v-if="score != null"
        :label="`Open ${title || 'score'} breakdown`"
        @click="breakdownOpen = true"
      >
        <AccessibilityScoreDonut
          variant="site-target"
          :score="score"
          ring-color="var(--ui-primary)"
          :chart-style="chartStyle"
        />
      </ScoreDonutButton>
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

    <ScoreBreakdownModal
      v-model:open="breakdownOpen"
      :model="breakdownModel"
    />
  </div>
</template>
