<script setup lang="ts">

import type { AccessibilityIssue, Scan } from '~/types/accessiq'

import type { SiteSettings, AccessibilityScoreCategoryId, AccessibilityScoreDetailRow } from '~/utils/siteSettings'

import type { DateRangeBounds } from '~/utils/overviewDateRange'

import { accessibilityScoreDetailRows } from '~/utils/siteSettings'

import type { ElementTotals, TargetCategoryScores } from '~/utils/siteimproveScore'

import {

  categoryScoreImpact,

  potentialOverallScoreForCategory

} from '~/utils/scoreCategoryDetails'



const props = defineProps<{

  settings: SiteSettings

  categoryScores: TargetCategoryScores

  overallScore: number

  scoreDelta: number | null

  siteId: string

  latestScanIssues: AccessibilityIssue[]

  scoringIssues: AccessibilityIssue[]

  scoreElementTotals?: ElementTotals | null

  scans: Scan[]

  pagesWithIssuesByScan: Map<string, number>

  rangeBounds: DateRangeBounds

}>()



const selectedCategory = ref<AccessibilityScoreCategoryId | null>(null)

const hoveredCategory = ref<AccessibilityScoreCategoryId | null>(null)

const impactModalOpen = ref(false)



const scoreRowsRef = ref<HTMLElement | null>(null)



const SITE_TARGET_SCORE_TOOLTIP =

  'Overall site target score combines WCAG level progress (90 points) and best-practice progress (10 points).'



const CONFORMANCE_LEVELS_TOOLTIP =

  'Per-category progress toward 100% for each level and practice included in your site target.'



const DELTA_TOOLTIP = 'Change in overall score since the previous completed scan in this period.'



const detailRows = computed(() => accessibilityScoreDetailRows(props.settings))



const selectedRow = computed((): AccessibilityScoreDetailRow | null => {

  if (!selectedCategory.value) return null

  return detailRows.value.find(r => r.id === selectedCategory.value) ?? null

})



const selectedScore = computed(() => {

  const row = selectedRow.value

  if (!row) return 0

  return scoreForRow(row)

})



const hoveredPotentialScore = computed(() => {

  if (impactModalOpen.value) return null

  const categoryId = hoveredCategory.value

  if (!categoryId) return null

  const impact = categoryScoreImpact(categoryId, props.scoringIssues, props.scoreElementTotals)

  if (impact <= 0) return null

  return potentialOverallScoreForCategory(

    categoryId,

    props.overallScore,

    props.scoringIssues,

    props.scoreElementTotals

  )

})



function scoreForRow(row: AccessibilityScoreDetailRow): number {

  switch (row.id) {

    case 'A': return props.categoryScores.levelA

    case 'AA': return props.categoryScores.levelAA

    case 'AAA': return props.categoryScores.levelAAA

    case 'aria': return props.categoryScores.aria

    case 'best_practice': return props.categoryScores.bestPractice

    default: return 0

  }

}



function isRowHovered(categoryId: AccessibilityScoreCategoryId): boolean {

  return hoveredCategory.value === categoryId

}



function isRowSelected(categoryId: AccessibilityScoreCategoryId): boolean {

  return impactModalOpen.value && selectedCategory.value === categoryId

}



function openRowModal(categoryId: AccessibilityScoreCategoryId) {

  selectedCategory.value = categoryId

  impactModalOpen.value = true

}



function openOverallModal() {

  selectedCategory.value = null

  impactModalOpen.value = true

}



function onCategoryEnter(categoryId: AccessibilityScoreCategoryId) {

  hoveredCategory.value = categoryId

}



function isWithinScoreRows(target: EventTarget | null): boolean {

  if (!(target instanceof Node)) return false

  return Boolean(scoreRowsRef.value?.contains(target))

}



function onCategoryLeave(categoryId: AccessibilityScoreCategoryId, event: MouseEvent) {

  if (isWithinScoreRows(event.relatedTarget)) return

  if (hoveredCategory.value === categoryId) {

    hoveredCategory.value = null

  }

}



function onCategoryBlur(categoryId: AccessibilityScoreCategoryId, event: FocusEvent) {

  if (isWithinScoreRows(event.relatedTarget)) return

  if (hoveredCategory.value === categoryId) {

    hoveredCategory.value = null

  }

}



watch(impactModalOpen, (open) => {

  if (!open) {

    selectedCategory.value = null

  }

})



const formattedDelta = computed(() => {

  const delta = props.scoreDelta

  if (delta == null) return null

  const rounded = Math.round(delta * 10) / 10

  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)

  return delta > 0 ? `+${text}` : text

})

</script>



<template>

  <div class="grid gap-4 lg:grid-cols-3 lg:items-stretch">

    <div class="flex flex-col">

      <p class="mb-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-default">

        Site target score

        <UTooltip :text="SITE_TARGET_SCORE_TOOLTIP" :popper="{ placement: 'top' }">

          <button

            type="button"

            class="text-muted hover:text-default transition-colors"

            aria-label="About site target score"

          >

            <UIcon name="i-lucide-circle-help" class="size-3.5" />

          </button>

        </UTooltip>

      </p>

      <div class="flex justify-center">

        <div class="inline-flex">

          <AccessibilityScoreDonut

            variant="site-target"

            :score="overallScore"

            :potential-score="hoveredPotentialScore"

            :delta="formattedDelta"

            :delta-tooltip="DELTA_TOOLTIP"

          />

        </div>

      </div>

    </div>



    <div class="lg:col-span-2">

      <AccessibilityTrendMetrics

        :scans="scans"

        :pages-with-issues-by-scan="pagesWithIssuesByScan"

        :range-bounds="rangeBounds"

      />

    </div>



    <div

      class="score-conformance-card flex h-full min-h-0 flex-col gap-3 rounded-lg border border-default bg-elevated/25 p-4"

    >

      <div class="flex min-h-[18px] items-center gap-1.5">

        <p class="text-sm font-bold text-default">

          Conformance levels

        </p>

        <UTooltip :text="CONFORMANCE_LEVELS_TOOLTIP" :popper="{ placement: 'top' }">

          <button

            type="button"

            class="text-muted hover:text-default transition-colors"

            aria-label="About conformance levels"

          >

            <UIcon name="i-lucide-circle-help" class="size-3.5" />

          </button>

        </UTooltip>

      </div>



      <div ref="scoreRowsRef" class="flex flex-1 flex-col justify-center gap-2">

        <AccessibilityScoreDetailRow

          v-for="row in detailRows"

          :key="row.id"

          :badge="row.badge"

          :badge-class="row.badgeClass"

          :label="row.label"

          :score="scoreForRow(row)"

          :active="isRowHovered(row.id)"

          :selected="isRowSelected(row.id)"

          @click="openRowModal(row.id)"

          @mouseenter="onCategoryEnter(row.id)"

          @mouseleave="onCategoryLeave(row.id, $event)"

          @focus="onCategoryEnter(row.id)"

          @blur="onCategoryBlur(row.id, $event)"

        />

      </div>

    </div>



    <div class="h-full min-h-0 lg:col-span-2">

      <AccessibilityScoreCategoryInfoPanel

        class="h-full"

        :issues="latestScanIssues"

        :scoring-issues="scoringIssues"

        :score-element-totals="scoreElementTotals"

        @view-impact="openOverallModal"

      />

    </div>

  </div>



  <AccessibilityScoreCategoryImpactModal

    v-model:open="impactModalOpen"

    :row="selectedRow"

    :score="selectedScore"

    :site-id="siteId"

    :issues="latestScanIssues"

    :scoring-issues="scoringIssues"

    :score-element-totals="scoreElementTotals"

  />

</template>


