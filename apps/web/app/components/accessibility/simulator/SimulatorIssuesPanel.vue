<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import { formatIssueSeverity } from '~/utils/issueExplanation'
import { impactRank, severityBadgeColor } from '~/utils/simulatorPages'

const props = defineProps<{
  issues: AccessibilityIssue[]
  loading?: boolean
  selectedIssueId?: string | null
}>()

const emit = defineEmits<{
  select: [AccessibilityIssue]
}>()

const sortedIssues = computed(() =>
  [...props.issues].sort((a, b) => impactRank(b.impact) - impactRank(a.impact))
)
</script>

<template>
  <aside class="flex flex-col min-h-0 h-full rounded-lg border border-default bg-default overflow-hidden">
    <div class="px-4 py-3 border-b border-default shrink-0">
      <h2 class="text-sm font-semibold text-default">Issues</h2>
      <p class="text-xs text-muted mt-0.5">
        {{ loading ? 'Loading…' : `${sortedIssues.length} open on this page` }}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="loading" class="p-4 space-y-3">
        <USkeleton v-for="n in 5" :key="n" class="h-14 w-full" />
      </div>

      <p
        v-else-if="!sortedIssues.length"
        class="p-4 text-sm text-muted"
      >
        No open accessibility issues on this page.
      </p>

      <ul v-else class="divide-y divide-default">
        <li
          v-for="issue in sortedIssues"
          :key="issue.id"
        >
          <button
            type="button"
            class="w-full text-left px-4 py-3 hover:bg-elevated/60 transition-colors"
            :class="selectedIssueId === issue.id ? 'bg-primary/5' : ''"
            @click="emit('select', issue)"
          >
            <div class="flex items-start gap-2">
              <UBadge
                :color="severityBadgeColor(issue.impact)"
                variant="subtle"
                size="sm"
                class="shrink-0 mt-0.5"
              >
                {{ formatIssueSeverity(issue.impact) }}
              </UBadge>
              <div class="min-w-0 flex-1 space-y-0.5">
                <p class="text-sm font-medium text-default line-clamp-2">
                  {{ issue.description }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ issue.rule_id }}
                  <span v-if="issue.wcag_level"> · WCAG {{ issue.wcag_level }}</span>
                </p>
              </div>
            </div>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
