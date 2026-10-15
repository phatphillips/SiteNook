<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  formatScoreImpact,
  overallQuickStats,
  overallScoreImpact,
  topFixRulesOverall
} from '~/utils/scoreCategoryDetails'
import type { ElementTotals } from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'

const props = defineProps<{
  issues: AccessibilityIssue[]
  scoringIssues: AccessibilityIssue[]
  scoreElementTotals?: ElementTotals | null
  checkStats?: A11yCheckStats | null
}>()

const emit = defineEmits<{
  'open-issue': [issue: AccessibilityIssue]
}>()

const scoreColor = computed(() => scoreRingColor(50))

const scoreImpact = computed(() =>
  overallScoreImpact(props.scoringIssues, props.scoreElementTotals, props.checkStats)
)

const stats = computed(() => overallQuickStats(props.issues))

const topFixes = computed(() =>
  topFixRulesOverall(
    props.issues,
    props.scoringIssues,
    props.scoreElementTotals,
    10,
    { requirePositivePoints: false, checkStats: props.checkStats }
  )
)

function issueForRule(ruleId: string): AccessibilityIssue | null {
  const fromScoring = props.scoringIssues.find(
    issue => issue.rule_id === ruleId && issue.status === 'open'
  )
  if (fromScoring) return fromScoring
  return props.issues.find(
    issue => issue.rule_id === ruleId && issue.status === 'open'
  ) ?? null
}

function openRule(ruleId: string) {
  const issue = issueForRule(ruleId)
  if (issue) emit('open-issue', issue)
}
</script>

<template>
  <div
    data-score-info-panel
    class="flex h-full min-h-0 w-full flex-col gap-4 rounded-lg border border-default bg-elevated p-4 shadow-none ring-0 sm:p-5"
  >
    <div class="flex min-h-[18px] min-w-0 items-center gap-2">
      <p class="min-w-0 text-base font-semibold text-highlighted">
        Score details
      </p>
    </div>

    <section class="space-y-1">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
        Score impact
      </h4>
      <p class="text-sm text-default">
        Open issues are dragging your overall score down by
        <span class="font-semibold tabular-nums" :style="{ color: scoreColor }">
          {{ formatScoreImpact(scoreImpact) }}
        </span>
        {{ scoreImpact === 1 ? 'point' : 'points' }}.
      </p>
    </section>

    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Quick stats
      </h4>
      <dl class="grid grid-cols-2 gap-3">
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <dt class="text-xs text-muted mb-1">Failing rules</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">{{ stats.failingRules }}</dd>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <dt class="text-xs text-muted mb-1">Pages affected</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">{{ stats.pagesAffected }}</dd>
        </div>
      </dl>
    </section>

    <section class="flex min-h-0 flex-1 flex-col">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Top 10 issues to fix
      </h4>
      <ul
        v-if="topFixes.length"
        class="min-h-0 flex-1 space-y-2 overflow-y-auto"
      >
        <li
          v-for="fix in topFixes"
          :key="fix.ruleId"
        >
          <button
            type="button"
            class="flex w-full items-start justify-between gap-3 rounded-lg border border-default bg-elevated px-3 py-2.5 text-left transition-colors hover:bg-muted hover:border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="openRule(fix.ruleId)"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-default truncate">{{ fix.ruleName }}</p>
              <p class="text-xs text-muted truncate">{{ fix.ruleId }}</p>
            </div>
            <span class="text-sm font-semibold tabular-nums text-success shrink-0">
              {{ formatPointsToGain(fix.points) }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">
        No open issues affecting your score.
      </p>
    </section>
  </div>
</template>
