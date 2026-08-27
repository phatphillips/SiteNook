<script setup lang="ts">
import type { Scan, SeoIssue } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import type { SeoIssueBreakdownRow } from '~/utils/seoIssueBreakdown'
import { totalOpenSeoIssues } from '~/utils/seoIssueBreakdown'
import { CHART_PURPLE_COLOR } from '~/utils/chartTheme'

const props = defineProps<{
  siteId: string
  scans: Scan[]
  expandScans?: Scan[]
  seoScore: number | null
  scoreDelta: number | null
  rangeBounds: DateRangeBounds
  breakdownRows: SeoIssueBreakdownRow[]
  selectedCategoryId?: string | null
  technicalScore: number | null
  crawlabilityScore: number | null
  contentScore: number | null
  avgReadabilityScore: number | null
  previewIssues: SeoIssue[]
}>()

const emit = defineEmits<{
  'update:selectedCategoryId': [categoryId: string | null]
}>()

const SEO_SCORE_TOOLTIP =
  'Overall SEO score reflects technical, crawlability, and content checks from your latest scan.'

const DELTA_TOOLTIP = 'Change in SEO score since the previous completed scan in this period.'

const openIssueTotal = computed(() =>
  totalOpenSeoIssues({
    technical: props.breakdownRows.find(row => row.id === 'technical')?.count ?? 0,
    crawlability: props.breakdownRows.find(row => row.id === 'crawlability')?.count ?? 0,
    content: props.breakdownRows.find(row => row.id === 'content')?.count ?? 0
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
    <div class="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div class="flex h-full flex-col rounded-lg border border-default bg-elevated/25 p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] flex-col items-start gap-1">
          <h3 class="flex items-center gap-1.5 text-lg font-semibold text-highlighted">
            SEO score
            <UTooltip :text="SEO_SCORE_TOOLTIP" :popper="{ placement: 'top' }">
              <button
                type="button"
                class="text-muted transition-colors hover:text-default"
                aria-label="About SEO score"
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
              v-if="seoScore != null"
              variant="site-target"
              :score="seoScore"
              label="SEO score"
              :ring-color="CHART_PURPLE_COLOR"
              :delta="formattedDelta"
              :delta-tooltip="DELTA_TOOLTIP"
            />
            <p v-else class="max-w-xs text-center text-sm text-muted">
              SEO score appears after a completed scan with SEO checks enabled.
            </p>
          </div>
          <p v-if="openIssueTotal" class="text-sm text-muted">
            {{ openIssueTotal }} open SEO issue{{ openIssueTotal === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <SeoIssueCategoriesPanel
        :rows="breakdownRows"
        :selected-category-id="selectedCategoryId"
        @update:selected-category-id="emit('update:selectedCategoryId', $event)"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-5 lg:items-stretch">
      <div class="flex min-h-0 flex-col gap-4 lg:col-span-3">
        <SeoTrendMetrics
          charts="score"
          tall
          :scans="scans"
          :seo-score="seoScore"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
        />
        <SeoTrendMetrics
          charts="issues"
          tall
          :scans="scans"
          :seo-score="seoScore"
          :range-bounds="rangeBounds"
          :expand-scans="expandScans"
        />
      </div>

      <div class="min-h-0 lg:col-span-2">
        <SeoCategoryInfoPanel
          class="h-full"
          :site-id="siteId"
          :rows="breakdownRows"
          :technical-score="technicalScore"
          :crawlability-score="crawlabilityScore"
          :content-score="contentScore"
          :avg-readability-score="avgReadabilityScore"
          :preview-issues="previewIssues"
        />
      </div>
    </div>
  </div>
</template>
