<script setup lang="ts">
import type { AccessibilityIssue, IssueFilters } from '~/types/sitenook'

const props = defineProps<{
  modelValue: IssueFilters
  issues: AccessibilityIssue[]
  filteredCount: number
  /** Unique issue types (by rule); defaults to raw open issue count */
  openCount?: number
  /** Total open axe node instances across all pages */
  openOccurrences?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [IssueFilters] }>()

const openIssues = computed(() =>
  props.issues.filter(i => i.status !== 'dismissed')
)

const totalOpenCount = computed(() => props.openCount ?? openIssues.value.length)
const totalOccurrences = computed(() => props.openOccurrences ?? openIssues.value.length)

function countImpact(impact: string): number {
  return openIssues.value.filter(i => i.impact === impact).length
}

function countWcag(level: 'A' | 'AA' | 'AAA'): number {
  return openIssues.value.filter(i => i.wcag_level === level).length
}

const impactPills = computed(() => [
  { id: 'critical', label: 'Critical', count: countImpact('critical') + countImpact('serious') },
  { id: 'moderate', label: 'Moderate', count: countImpact('moderate') },
  { id: 'minor', label: 'Minor', count: countImpact('minor') }
])

const wcagPills = computed(() => [
  { id: 'AA', label: 'AA', count: countWcag('AA') },
  { id: 'AAA', label: 'AAA', count: countWcag('AAA') },
  { id: 'A', label: 'A', count: countWcag('A') }
])

const allSelected = computed(() =>
  props.modelValue.impacts.length === 0
  && props.modelValue.wcagLevels.length === 0
  && props.modelValue.targetCategories.length === 0
)

function toggleImpact(impactId: string) {
  const impacts = [...props.modelValue.impacts]
  if (impactId === 'critical') {
    const hasCritical = impacts.includes('critical') || impacts.includes('serious')
    if (hasCritical) {
      emit('update:modelValue', {
        ...props.modelValue,
        impacts: impacts.filter(i => i !== 'critical' && i !== 'serious')
      })
    } else {
      emit('update:modelValue', {
        ...props.modelValue,
        impacts: [...impacts.filter(i => i !== 'critical' && i !== 'serious'), 'critical', 'serious']
      })
    }
    return
  }
  const idx = impacts.indexOf(impactId)
  if (idx >= 0) impacts.splice(idx, 1)
  else impacts.push(impactId)
  emit('update:modelValue', { ...props.modelValue, impacts })
}

function isImpactActive(impactId: string): boolean {
  if (impactId === 'critical') {
    return props.modelValue.impacts.includes('critical') || props.modelValue.impacts.includes('serious')
  }
  return props.modelValue.impacts.includes(impactId)
}

function selectAll() {
  emit('update:modelValue', {
    ...props.modelValue,
    impacts: [],
    wcagLevels: [],
    targetCategories: [],
    types: [],
    elements: [],
    roles: []
  })
}

function toggleWcag(level: 'A' | 'AA' | 'AAA') {
  const levels = [...props.modelValue.wcagLevels]
  const idx = levels.indexOf(level)
  if (idx >= 0) levels.splice(idx, 1)
  else levels.push(level)
  emit('update:modelValue', { ...props.modelValue, wcagLevels: levels })
}

function pillClass(active: boolean): string {
  return active
    ? 'bg-elevated text-default border-default ring-1 ring-default shadow-sm'
    : 'bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-default'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
        :class="pillClass(allSelected)"
        @click="selectAll"
      >
        All
        <span
          class="tabular-nums text-xs px-1.5 py-0.5 rounded-full"
          :class="allSelected ? 'bg-default' : 'bg-elevated'"
        >
          {{ openIssues.length }}
        </span>
      </button>

      <span class="text-muted text-xs hidden sm:inline">|</span>

      <button
        v-for="pill in impactPills"
        :key="pill.id"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
        :class="pillClass(isImpactActive(pill.id))"
        @click="toggleImpact(pill.id)"
      >
        {{ pill.label }}
        <span
          class="tabular-nums text-xs px-1.5 py-0.5 rounded-full"
          :class="isImpactActive(pill.id) ? 'bg-default' : 'bg-elevated'"
        >
          {{ pill.count }}
        </span>
      </button>

      <button
        v-for="pill in wcagPills"
        :key="pill.id"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
        :class="pillClass(modelValue.wcagLevels.includes(pill.id))"
        @click="toggleWcag(pill.id as 'A' | 'AA' | 'AAA')"
      >
        {{ pill.label }}
        <span
          class="tabular-nums text-xs px-1.5 py-0.5 rounded-full"
          :class="modelValue.wcagLevels.includes(pill.id) ? 'bg-default' : 'bg-elevated'"
        >
          {{ pill.count }}
        </span>
      </button>
    </div>

    <p class="text-sm text-muted">
      Showing {{ filteredCount }} of {{ totalOpenCount }} issue types
      ({{ totalOccurrences }} occurrences)
    </p>
  </div>
</template>
