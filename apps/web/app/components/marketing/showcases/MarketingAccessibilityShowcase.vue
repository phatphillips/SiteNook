<script setup lang="ts">
import {
  MARKETING_DEMO_A11Y_SCORE,
  MARKETING_DEMO_ISSUES,
  MARKETING_DEMO_OPEN_ISSUE_COUNT,
  MARKETING_DEMO_PAGES_BY_RULE,
  MARKETING_DEMO_PAGES_WITH_ISSUES_BY_SCAN,
  MARKETING_DEMO_POINTS_TO_GAIN,
  MARKETING_DEMO_SCANS
} from '~/utils/marketingDemoData'
import { overviewRangeBounds } from '~/utils/overviewDateRange'

const rangeBounds = overviewRangeBounds({ preset: 30 })

const overviewOpenColumnVisibility = {
  issue: true,
  impact: true,
  pointsToGain: true,
  wcag_level: false,
  wcag_sc: false,
  responsible_role: false,
  element_type: false,
  pages: false,
  occurrences: false
}
</script>

<template>
  <div class="marketing-a11y-showcase space-y-5">
    <div class="grid items-stretch gap-4 lg:grid-cols-3 lg:gap-4">
      <div class="flex flex-col items-center justify-center gap-1.5">
        <AccessibilityScoreDonut
          :score="MARKETING_DEMO_A11Y_SCORE"
          label="Accessibility score"
        />
        <p class="text-center text-xs text-muted">
          {{ MARKETING_DEMO_OPEN_ISSUE_COUNT }} open issues
        </p>
      </div>

      <div class="min-w-0 lg:col-span-2">
        <AccessibilityTrendMetrics
          :scans="MARKETING_DEMO_SCANS"
          :pages-with-issues-by-scan="MARKETING_DEMO_PAGES_WITH_ISSUES_BY_SCAN"
          :range-bounds="rangeBounds"
        />
      </div>
    </div>

    <AccessibilityIssuesTable
      class="marketing-a11y-showcase__table"
      table-title="Top open issues"
      :default-column-visibility="overviewOpenColumnVisibility"
      :issues="MARKETING_DEMO_ISSUES"
      :scoring-issues="MARKETING_DEMO_ISSUES"
      :points-to-gain-by-rule="MARKETING_DEMO_POINTS_TO_GAIN"
      :pages-by-rule="MARKETING_DEMO_PAGES_BY_RULE"
      read-only
      hide-toolbar
      :page-size="5"
    />
  </div>
</template>

<style scoped>
/* Match demo nav text-xs sizing inside the product frame. */
.marketing-a11y-showcase__table :deep(.issues-table-panel h2) {
  font-size: 0.75rem;
  line-height: 1rem;
}

.marketing-a11y-showcase__table :deep(th),
.marketing-a11y-showcase__table :deep(td),
.marketing-a11y-showcase__table :deep(td *),
.marketing-a11y-showcase__table :deep(button),
.marketing-a11y-showcase__table :deep(.text-sm) {
  font-size: 0.75rem !important;
  line-height: 1.15rem !important;
}

.marketing-a11y-showcase__table :deep(th) {
  font-weight: 500;
}
</style>
