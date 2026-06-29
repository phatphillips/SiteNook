<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/accessiq'

const props = defineProps<{
  issues: AccessibilityIssue[]
}>()

const counts = computed(() => {
  const open = props.issues.filter(i => i.status !== 'dismissed')
  let critical = 0
  let moderate = 0
  let minor = 0
  for (const issue of open) {
    if (issue.impact === 'critical' || issue.impact === 'serious') critical++
    else if (issue.impact === 'moderate') moderate++
    else minor++
  }
  return { critical, moderate, minor }
})

const cards = computed(() => [
  { key: 'critical', label: 'Critical', count: counts.value.critical, colorVar: 'var(--color-text-danger)', dotClass: 'bg-red-500' },
  { key: 'moderate', label: 'Moderate', count: counts.value.moderate, colorVar: 'var(--color-text-warning)', dotClass: 'bg-amber-500' },
  { key: 'minor', label: 'Minor', count: counts.value.minor, colorVar: 'var(--color-text-info)', dotClass: 'bg-blue-500' }
])
</script>

<template>
  <div class="severity-stat-grid">
    <div
      v-for="card in cards"
      :key="card.key"
      class="severity-stat-card"
    >
      <span
        class="severity-stat-count tabular-nums"
        :style="{ color: card.colorVar }"
      >
        {{ card.count }}
      </span>
      <span class="severity-stat-label">
        <span class="severity-stat-dot" :class="card.dotClass" aria-hidden="true" />
        {{ card.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.severity-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.severity-stat-card {
  background: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  padding: 10px 12px;
}

.severity-stat-count {
  display: block;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
}

.severity-stat-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.severity-stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}
</style>
