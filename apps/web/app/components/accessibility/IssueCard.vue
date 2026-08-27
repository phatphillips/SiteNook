<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import {
  issueTargetCategory,
  issueTargetCategoryLabel,
  issueWcagLevelDisplay
} from '~/utils/issueLabels'

const props = defineProps<{
  issue: AccessibilityIssue
  affectedPageUrls?: string[]
}>()

const emit = defineEmits<{ open: [] }>()

const category = computed(() => issueTargetCategory(props.issue))
const wcagLevel = computed(() => issueWcagLevelDisplay(props.issue))

const severityLabel = computed(() => {
  const impact = props.issue.impact
  if (impact === 'critical' || impact === 'serious') return 'Critical'
  return impact.charAt(0).toUpperCase() + impact.slice(1)
})

const severityDotClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'bg-red-500',
    serious: 'bg-red-500',
    moderate: 'bg-amber-500',
    minor: 'bg-blue-500'
  }
  return map[props.issue.impact] || 'bg-muted'
})

const affectedCount = computed(() => props.affectedPageUrls?.length ?? 0)

const ariaLabel = computed(() => `View details for ${props.issue.description}`)

function openDrawer() {
  emit('open')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openDrawer()
  }
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    class="rounded-lg border border-default bg-elevated/25 p-4 cursor-pointer transition-colors hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-default"
    @click="openDrawer"
    @keydown="onKeydown"
  >
    <div class="flex items-center gap-2 mb-2 min-w-0">
      <UBadge variant="subtle" class="shrink-0">
        {{ issueTargetCategoryLabel(category) }}
      </UBadge>
      <UBadge
        v-if="wcagLevel"
        variant="subtle"
        class="shrink-0"
      >
        {{ wcagLevel }}
      </UBadge>
      <code class="text-xs text-muted truncate font-mono min-w-0 flex-1" :title="issue.rule_id">
        {{ issue.rule_id }}
      </code>
      <UIcon
        name="i-lucide-chevron-right"
        class="size-4 text-muted ml-auto shrink-0"
        aria-hidden="true"
      />
    </div>

    <p class="font-semibold text-base mb-2 text-highlighted">
      {{ issue.description }}
    </p>

    <p class="text-sm text-muted flex items-center gap-1.5 flex-wrap">
      <span
        class="inline-block size-2 rounded-full shrink-0"
        :class="severityDotClass"
        aria-hidden="true"
      />
      <span>{{ severityLabel }}</span>
      <span v-if="affectedCount > 0" aria-hidden="true">·</span>
      <span v-if="affectedCount > 0">
        {{ affectedCount }} {{ affectedCount === 1 ? 'page' : 'pages' }} affected
      </span>
    </p>
  </div>
</template>
