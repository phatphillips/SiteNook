<script setup lang="ts">
import type { Scan, SeoCrawlAudit, SeoIssue } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import type { SeoIssueBreakdownRow } from '~/utils/seoIssueBreakdown'
import { totalOpenSeoIssues } from '~/utils/seoIssueBreakdown'
import { DONUT_SEGMENT_TOKENS } from '~/utils/donutChart'
import type { ScoreBreakdownModel } from '~/utils/scoreBreakdown'
import { formatBreakdownDelta, progressScoreSlices } from '~/utils/scoreBreakdown'

const props = defineProps<{
  siteId: string
  scans: Scan[]
  expandScans?: Scan[]
  seoScore: number | null
  scoreDelta: number | null
  rangeBounds: DateRangeBounds
  breakdownRows: SeoIssueBreakdownRow[]
  technicalScore: number | null
  crawlabilityScore: number | null
  contentScore: number | null
  avgReadabilityScore: number | null
  previewIssues: SeoIssue[]
  crawlAudit?: SeoCrawlAudit | null
}>()

const emit = defineEmits<{
  'view-issue': [issue: SeoIssue]
}>()

const SEO_SCORE_TOOLTIP =
  'Overall SEO score reflects technical, crawlability, and content checks from your latest scan.'

const DELTA_TOOLTIP = 'Change in SEO score since the previous completed scan in this period.'

const categoryModalOpen = ref(false)
const selectedCategory = ref<SeoIssueBreakdownRow | null>(null)
const breakdownOpen = ref(false)
const { chartStyle } = useDonutChartStyle()

const openIssueTotal = computed(() =>
  totalOpenSeoIssues({
    technical: props.breakdownRows.find(row => row.id === 'technical')?.count ?? 0,
    crawlability: props.breakdownRows.find(row => row.id === 'crawlability')?.count ?? 0,
    content: props.breakdownRows.find(row => row.id === 'content')?.count ?? 0
  })
)

const formattedDelta = computed(() => formatBreakdownDelta(props.scoreDelta))

function openCategoryModal(row: SeoIssueBreakdownRow) {
  selectedCategory.value = row
  categoryModalOpen.value = true
}

function openBreakdownModal() {
  breakdownOpen.value = true
}

function scoreForSeoCategory(id: SeoIssueBreakdownRow['id']): number | null {
  switch (id) {
    case 'technical': return props.technicalScore
    case 'crawlability': return props.crawlabilityScore
    case 'content': return props.contentScore
    default: return null
  }
}

const breakdownModel = computed((): ScoreBreakdownModel | null => {
  if (props.seoScore == null) return null

  const rows = props.breakdownRows.map((row, index) => {
    const score = scoreForSeoCategory(row.id)
    return {
      id: row.id,
      label: row.label,
      value: Math.max(score ?? row.count, 0.01),
      color: row.accentColor || DONUT_SEGMENT_TOKENS[index % DONUT_SEGMENT_TOKENS.length]!,
      score,
      detail: `${row.count} open issue${row.count === 1 ? '' : 's'}`,
      href: row.to
    }
  })

  return {
    title: 'SEO score breakdown',
    description: 'How technical, crawlability, and content checks combine into the overall SEO score.',
    score: props.seoScore,
    caption: 'SEO score',
    scoreExplainer: SEO_SCORE_TOOLTIP,
    delta: formattedDelta.value,
    deltaLabel: 'Since last scan',
    slices: progressScoreSlices(props.seoScore, {
      scoreLabel: 'Current score',
      remainderLabel: 'Remaining to 100'
    }),
    rows,
    stats: [
      { label: 'Open issues', value: String(openIssueTotal.value) },
      ...(props.avgReadabilityScore != null
        ? [{ label: 'Avg readability', value: String(props.avgReadabilityScore) }]
        : [])
    ],
    footnote: 'Open a category for the checks and pages affecting that part of the score.',
    ctaLabel: 'View SEO issues',
    ctaTo: `/sites/${props.siteId}/seo/technical`
  }
})

watch(categoryModalOpen, (open) => {
  if (!open) selectedCategory.value = null
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div class="relative flex h-full flex-col rounded-lg border border-default bg-elevated p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col items-start gap-1">
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
          <ScoreDonutMenu
            :breakdown-disabled="seoScore == null"
            @breakdown="openBreakdownModal"
          />
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 overflow-visible">
          <div
            v-if="seoScore != null"
            class="mx-auto w-full max-w-[min(100%,17.75rem)] overflow-visible"
          >
            <ScoreDonutButton
              label="Open SEO score breakdown"
              @click="openBreakdownModal"
            >
              <AccessibilityScoreDonut
                variant="site-target"
                :score="seoScore"
                label="SEO score"
                ring-color="var(--ui-primary)"
                :delta="formattedDelta"
                :delta-tooltip="DELTA_TOOLTIP"
                :chart-style="chartStyle"
              />
            </ScoreDonutButton>
          </div>
          <p v-else class="max-w-xs text-center text-sm text-muted">
            SEO score appears after a completed scan with SEO checks enabled.
          </p>
          <p v-if="openIssueTotal" class="text-sm text-muted">
            {{ openIssueTotal }} open SEO issue{{ openIssueTotal === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <SeoIssueCategoriesPanel
        :rows="breakdownRows"
        :selected-category-id="selectedCategory?.id ?? null"
        @select="openCategoryModal"
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

    <SeoCategoryInfoModal
      v-model:open="categoryModalOpen"
      :row="selectedCategory"
      :technical-score="technicalScore"
      :crawlability-score="crawlabilityScore"
      :content-score="contentScore"
      :avg-readability-score="avgReadabilityScore"
      :preview-issues="previewIssues"
      :crawl-audit="crawlAudit"
      @view-issue="emit('view-issue', $event)"
    />

    <ScoreBreakdownModal
      v-model:open="breakdownOpen"
      :model="breakdownModel"
    />
  </div>
</template>
