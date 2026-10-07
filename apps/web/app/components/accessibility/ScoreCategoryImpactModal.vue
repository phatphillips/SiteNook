<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import type { AccessibilityScoreDetailRow } from '~/utils/siteSettings'
import type { ElementTotals } from '~/utils/siteimproveScore'
import type { A11yCheckStats } from '~/utils/a11yCheckStats'
import {
  categoryQuickStats,
  categoryScoreImpact,
  formatScoreImpact,
  issuesLinkForCategory,
  overallQuickStats,
  overallScoreImpact,
  topFixRulesForCategory,
  topFixRulesOverall,
  viewAllIssuesLabel
} from '~/utils/scoreCategoryDetails'

const props = defineProps<{
  open: boolean
  row: AccessibilityScoreDetailRow | null
  score: number
  siteId: string
  issues: AccessibilityIssue[]
  scoringIssues: AccessibilityIssue[]
  scoreElementTotals?: ElementTotals | null
  checkStats?: A11yCheckStats | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const scoreColor = computed(() =>
  props.row ? scoreRingColor(props.score) : scoreRingColor(50)
)

const scoreImpact = computed(() => {
  if (props.row) {
    return categoryScoreImpact(props.row.id, props.scoringIssues, props.scoreElementTotals, props.checkStats)
  }
  return overallScoreImpact(props.scoringIssues, props.scoreElementTotals, props.checkStats)
})

const stats = computed(() => {
  if (props.row) {
    return categoryQuickStats(props.issues, props.row.id)
  }
  return overallQuickStats(props.issues)
})

const topFixes = computed(() => {
  if (props.row) {
    return topFixRulesForCategory(
      props.issues,
      props.scoringIssues,
      props.row.id,
      props.scoreElementTotals,
      3,
      { checkStats: props.checkStats }
    )
  }
  return topFixRulesOverall(
    props.issues,
    props.scoringIssues,
    props.scoreElementTotals,
    5,
    { checkStats: props.checkStats }
  )
})

const issuesLink = computed(() =>
  props.row
    ? issuesLinkForCategory(props.siteId, props.row.id)
    : `/sites/${props.siteId}/accessibility/issues`
)

const viewAllLabel = computed(() =>
  props.row ? viewAllIssuesLabel(props.row) : 'View all issues'
)

const modalTitle = computed(() =>
  props.row ? `${props.row.label}. Score impact` : 'Score impact'
)

const impactIntro = computed(() =>
  props.row
    ? 'This level is dragging your overall score down by'
    : 'Open issues are dragging your overall score down by'
)

const emptyTopFixesMessage = computed(() =>
  props.row
    ? 'No open issues dragging this level\'s score.'
    : 'No open issues affecting your score.'
)
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="modalTitle"
    :ui="{ content: 'sm:max-w-lg', description: 'text-muted' }"
  >
    <template #body>
      <div class="space-y-6" data-score-impact-modal>
        <section>
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Score impact
          </h4>
          <p class="text-sm text-default">
            {{ impactIntro }}
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
          <dl class="grid grid-cols-3 gap-3">
            <div class="rounded-lg bg-elevated/40 ring-1 ring-default p-3 text-center">
              <dt class="text-xs text-muted mb-1">Failing rules</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">{{ stats.failingRules }}</dd>
            </div>
            <div class="rounded-lg bg-elevated/40 ring-1 ring-default p-3 text-center">
              <dt class="text-xs text-muted mb-1">Occurrences</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">{{ stats.occurrences }}</dd>
            </div>
            <div class="rounded-lg bg-elevated/40 ring-1 ring-default p-3 text-center">
              <dt class="text-xs text-muted mb-1">Pages affected</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">{{ stats.pagesAffected }}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            Top rules to fix
          </h4>
          <ul v-if="topFixes.length" class="space-y-2">
            <li
              v-for="fix in topFixes"
              :key="fix.ruleId"
              class="flex items-start justify-between gap-3 rounded-lg bg-elevated/40 ring-1 ring-default px-3 py-2.5"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-default truncate">{{ fix.ruleName }}</p>
                <p class="text-xs text-muted truncate">{{ fix.ruleId }}</p>
              </div>
              <span class="text-sm font-semibold tabular-nums text-success shrink-0">
                {{ formatPointsToGain(fix.points) }}
              </span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">
            {{ emptyTopFixesMessage }}
          </p>
        </section>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          :to="issuesLink"
          trailing-icon="i-lucide-arrow-right"
          @click="openModel = false"
        >
          {{ viewAllLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
