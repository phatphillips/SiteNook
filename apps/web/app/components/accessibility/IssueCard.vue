<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/accessiq'

const props = defineProps<{ issue: AccessibilityIssue }>()
const emit = defineEmits<{ fix: [], dismiss: [] }>()

const borderColor = computed(() => {
  const map: Record<string, string> = {
    critical: 'border-l-red-500',
    serious: 'border-l-orange-500',
    moderate: 'border-l-yellow-500',
    minor: 'border-l-gray-400'
  }
  return map[props.issue.impact] || 'border-l-gray-400'
})

const expanded = ref(false)
const wcagUrl = computed(() =>
  props.issue.wcag_sc
    ? `https://www.w3.org/WAI/WCAG22/Understanding/${props.issue.wcag_sc.replace(/\./g, '')}`
    : props.issue.help_url
)
</script>

<template>
  <UCard
    class="border-l-4"
    :class="borderColor"
    :ui="{ body: 'p-4' }"
  >
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <UBadge :color="issue.impact === 'critical' ? 'error' : issue.impact === 'serious' ? 'warning' : 'neutral'" variant="subtle">
        {{ issue.impact.toUpperCase() }}
      </UBadge>
      <UBadge :color="issue.wcag_level === 'A' ? 'error' : 'warning'" variant="subtle">
        {{ issue.wcag_level }}
      </UBadge>
      <NuxtLink v-if="issue.wcag_sc" :to="wcagUrl" target="_blank" class="text-sm text-primary hover:underline">
        SC {{ issue.wcag_sc }}
      </NuxtLink>
      <code class="text-xs text-muted">{{ issue.rule_id }}</code>
    </div>

    <p class="font-medium mb-2">{{ issue.description }}</p>

    <pre
      v-if="issue.html_snippet"
      class="text-xs bg-elevated rounded p-2 overflow-hidden"
      :class="expanded ? '' : 'line-clamp-3'"
    ><code>{{ issue.html_snippet }}</code></pre>
    <UButton v-if="issue.html_snippet && issue.html_snippet.length > 120" variant="link" size="xs" @click="expanded = !expanded">
      {{ expanded ? 'Show less' : 'Show more' }}
    </UButton>

    <p v-if="issue.css_selector" class="text-xs text-muted mt-2 font-mono">{{ issue.css_selector }}</p>

    <div class="flex gap-2 mt-3">
      <UButton size="xs" @click="emit('fix')">Fix</UButton>
      <UButton size="xs" color="neutral" variant="outline" @click="emit('dismiss')">Dismiss</UButton>
    </div>
  </UCard>
</template>
