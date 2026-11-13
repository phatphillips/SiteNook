<script setup lang="ts">
import type { BrokenLink, PolicyMatch, SpellingIssue, Scan } from '~/types/sitenook'
import type { DateRangeBounds } from '~/utils/overviewDateRange'
import type { QaIssueBreakdownRow } from '~/utils/qaIssueBreakdown'
import { totalOpenQaIssues } from '~/utils/qaIssueBreakdown'
import { DONUT_SEGMENT_TOKENS } from '~/utils/donutChart'
import type { ScoreBreakdownModel } from '~/utils/scoreBreakdown'
import { formatBreakdownDelta, progressScoreSlices } from '~/utils/scoreBreakdown'

const props = defineProps<{
  siteId: string
  scans: Scan[]
  expandScans?: Scan[]
  qaScore: number | null
  scoreDelta: number | null
  rangeBounds: DateRangeBounds
  breakdownRows: QaIssueBreakdownRow[]
  previewBrokenLinks: BrokenLink[]
  previewSpelling: SpellingIssue[]
  previewPolicyMatches: PolicyMatch[]
  internalBrokenLinkCount: number
  externalBrokenLinkCount: number
  wordsToReviewCount: number
  avgReadability: number
}>()

const QA_SCORE_TOOLTIP =
  'Overall QA score reflects open findings from broken links, spelling, readability, and policy checks in your report scope.'

const DELTA_TOOLTIP = 'Change in QA score since the previous completed scan in this period.'

const categoryModalOpen = ref(false)
const selectedCategory = ref<QaIssueBreakdownRow | null>(null)
const breakdownOpen = ref(false)
const { chartStyle } = useDonutChartStyle()

const openIssueTotal = computed(() =>
  totalOpenQaIssues({
    brokenLinks: props.breakdownRows.find(row => row.id === 'broken_links')?.count ?? 0,
    misspellings: props.breakdownRows.find(row => row.id === 'misspellings')?.count ?? 0,
    policies: props.breakdownRows.find(row => row.id === 'policies')?.count ?? 0
  })
)

const formattedDelta = computed(() => formatBreakdownDelta(props.scoreDelta))

function openCategoryModal(row: QaIssueBreakdownRow) {
  selectedCategory.value = row
  categoryModalOpen.value = true
}

function openBreakdownModal() {
  breakdownOpen.value = true
}

const breakdownModel = computed((): ScoreBreakdownModel | null => {
  if (props.qaScore == null) return null

  const rows = props.breakdownRows.map((row, index) => {
    let detail = `${row.count} open`
    if (row.id === 'broken_links') {
      detail = `${row.count} broken · ${props.internalBrokenLinkCount} internal · ${props.externalBrokenLinkCount} external`
    } else if (row.id === 'misspellings' || row.id === 'words_to_review') {
      detail = `${row.count} flagged · ${props.wordsToReviewCount} words to review`
    }
    return {
      id: row.id,
      label: row.label,
      value: Math.max(row.count, 0.01),
      color: row.accentColor || DONUT_SEGMENT_TOKENS[index % DONUT_SEGMENT_TOKENS.length]!,
      detail,
      href: row.to
    }
  })

  return {
    title: 'QA score breakdown',
    description: 'Open findings by category. Links and spelling drive the score; policies and inventory stay visible as QA findings.',
    score: props.qaScore,
    caption: 'QA score',
    scoreExplainer: QA_SCORE_TOOLTIP,
    delta: formattedDelta.value,
    deltaLabel: 'Since last scan',
    slices: progressScoreSlices(props.qaScore, {
      scoreLabel: 'Current score',
      remainderLabel: 'Remaining to 100'
    }),
    rows,
    stats: [
      { label: 'Open issues', value: String(openIssueTotal.value) },
      ...(props.avgReadability
        ? [{ label: 'Avg readability', value: String(props.avgReadability) }]
        : [])
    ],
    footnote: 'Score weighting: broken links 65%, spelling 35%. Policy and inventory counts are tracked separately.',
    ctaLabel: 'View QA issues',
    ctaTo: `/sites/${props.siteId}/qa/links`
  }
})

watch(categoryModalOpen, (open) => {
  if (!open) selectedCategory.value = null
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Row 1: QA score + issue categories -->
    <div class="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div class="relative flex h-full flex-col rounded-lg border border-default bg-elevated p-4 shadow-none ring-0 sm:p-5">
        <div class="mb-4 flex min-h-[18px] items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col items-start gap-1">
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
          <ScoreDonutMenu
            :breakdown-disabled="qaScore == null"
            @breakdown="openBreakdownModal"
          />
        </div>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 overflow-visible">
          <div
            v-if="qaScore != null"
            class="mx-auto w-full max-w-[min(100%,17.75rem)] overflow-visible"
          >
            <ScoreDonutButton
              label="Open QA score breakdown"
              @click="openBreakdownModal"
            >
              <AccessibilityScoreDonut
                variant="site-target"
                :score="qaScore"
                label="QA score"
                ring-color="var(--ui-primary)"
                :delta="formattedDelta"
                :delta-tooltip="DELTA_TOOLTIP"
                :chart-style="chartStyle"
              />
            </ScoreDonutButton>
          </div>
          <p v-else class="max-w-xs text-center text-sm text-muted">
            QA score appears after a completed scan with quality checks enabled.
          </p>
          <p v-if="openIssueTotal" class="text-sm text-muted">
            {{ openIssueTotal }} open QA issue{{ openIssueTotal === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <QaIssueCategoriesPanel
        :rows="breakdownRows"
        :selected-category-id="selectedCategory?.id ?? null"
        @select="openCategoryModal"
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

    <QaCategoryInfoModal
      v-model:open="categoryModalOpen"
      :row="selectedCategory"
      :preview-broken-links="previewBrokenLinks"
      :preview-spelling="previewSpelling"
      :preview-policy-matches="previewPolicyMatches"
      :internal-broken-link-count="internalBrokenLinkCount"
      :external-broken-link-count="externalBrokenLinkCount"
      :words-to-review-count="wordsToReviewCount"
      :avg-readability="avgReadability"
    />

    <ScoreBreakdownModal
      v-model:open="breakdownOpen"
      :model="breakdownModel"
    />
  </div>
</template>
