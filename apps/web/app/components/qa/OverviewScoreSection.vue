<script setup lang="ts">
import type { BrokenLink, PolicyMatch, SpellingIssue, Scan } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import type { QaIssueBreakdownRow } from '~/utils/qaIssueBreakdown'
import { totalOpenQaIssues } from '~/utils/qaIssueBreakdown'
import { CHART_PURPLE_COLOR } from '~/utils/chartTheme'

const props = defineProps<{
  siteId: string
  scans: Scan[]
  expandScans?: Scan[]
  qaScore: number | null
  scoreDelta: number | null
  rangeBounds: DateRangeBounds
  breakdownRows: QaIssueBreakdownRow[]
  selectedCategoryId?: string | null
  previewBrokenLinks: BrokenLink[]
  previewSpelling: SpellingIssue[]
  previewPolicyMatches: PolicyMatch[]
  internalBrokenLinkCount: number
  externalBrokenLinkCount: number
  wordsToReviewCount: number
  avgReadability: number
}>()

const emit = defineEmits<{
  'update:selectedCategoryId': [categoryId: string | null]
}>()

const QA_SCORE_TOOLTIP =
  'Overall QA score reflects open findings from broken links, spelling, readability, and policy checks in your report scope.'

const DELTA_TOOLTIP = 'Change in QA score since the previous completed scan in this period.'

const openIssueTotal = computed(() =>
  totalOpenQaIssues({
    brokenLinks: props.breakdownRows.find(row => row.id === 'broken_links')?.count ?? 0,
    misspellings: props.breakdownRows.find(row => row.id === 'misspellings')?.count ?? 0,
    policies: props.breakdownRows.find(row => row.id === 'policies')?.count ?? 0
  })
)

const formattedDelta = computed(() => {
  const delta = props.scoreDelta
  if (delta == null) return null
  const rounded = Math.round(delta * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return delta > 0 ? `+${text}` : text
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Row 1: QA score + issue categories -->
    <div class="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div class="flex h-full flex-col rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] flex-col items-start gap-1">
          <h3 class="flex items-center gap-1.5 text-lg font-semibold text-highlighted">
            QA score
            <UTooltip :text="QA_SCORE_TOOLTIP" :popper="{ placement: 'top' }">
              <button
                type="button"
                class="text-muted transition-colors hover:text-default"
                aria-label="About QA score"
              >
                <UIcon name="i-lucide-circle-help" class="size-3.5" />
              </button>
            </UTooltip>
          </h3>
          <p class="text-sm text-muted">
            Score and trends for this site over the selected period.
          </p>
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2">
          <div class="inline-flex">
            <AccessibilityScoreDonut
              v-if="qaScore != null"
              variant="site-target"
              :score="qaScore"
              label="QA score"
              :ring-color="CHART_PURPLE_COLOR"
              :delta="formattedDelta"
              :delta-tooltip="DELTA_TOOLTIP"
            />
            <p v-else class="max-w-xs text-center text-sm text-muted">
              QA score appears after a completed scan with quality checks enabled.
            </p>
          </div>
          <p v-if="openIssueTotal" class="text-sm text-muted">
            {{ openIssueTotal }} open QA issue{{ openIssueTotal === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <QaIssueCategoriesPanel
        :rows="breakdownRows"
        :selected-category-id="selectedCategoryId"
        @update:selected-category-id="emit('update:selectedCategoryId', $event)"
      />
    </div>

    <!-- Row 2: trends (left) | category details (right) -->
    <div class="grid gap-4 lg:grid-cols-5 lg:items-stretch">
      <div class="flex min-h-0 flex-col gap-4 lg:col-span-3">
        <QaTrendMetrics
          charts="score"
          tall
          :scans="scans"
          :qa-score="qaScore"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
        />
        <QaTrendMetrics
          charts="broken_links"
          tall
          :scans="scans"
          :qa-score="qaScore"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
        />
      </div>

      <div class="min-h-0 lg:col-span-2">
        <QaCategoryInfoPanel
          class="h-full"
          :site-id="siteId"
          :rows="breakdownRows"
          :preview-broken-links="previewBrokenLinks"
          :preview-spelling="previewSpelling"
          :preview-policy-matches="previewPolicyMatches"
          :internal-broken-link-count="internalBrokenLinkCount"
          :external-broken-link-count="externalBrokenLinkCount"
          :words-to-review-count="wordsToReviewCount"
          :avg-readability="avgReadability"
        />
      </div>
    </div>
  </div>
</template>
