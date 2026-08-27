<script setup lang="ts">
import type { AccessibilityIssue, IssueFilters } from '~/types/sitenook'
import { classifyIssueCategory, type IssueTargetCategory } from '~/utils/siteSettings'
import { issueTargetCategoryLabel } from '~/utils/issueLabels'

const props = defineProps<{
  modelValue: IssueFilters
  issues: AccessibilityIssue[]
}>()

const emit = defineEmits<{ 'update:modelValue': [IssueFilters] }>()

const openIssues = computed(() =>
  props.issues.filter(i => i.status !== 'dismissed')
)

function countImpact(impact: string): number {
  return openIssues.value.filter(i => i.impact === impact).length
}

function countWcag(level: 'A' | 'AA' | 'AAA'): number {
  return openIssues.value.filter(i => i.wcag_level === level).length
}

function countTargetCategory(category: IssueTargetCategory): number {
  return openIssues.value.filter(i => classifyIssueCategory(i) === category).length
}

const TARGET_CATEGORY_OPTIONS: IssueTargetCategory[] = ['wcag', 'aria', 'best_practice']

const allSelected = computed(() =>
  props.modelValue.impacts.length === 0
  && props.modelValue.wcagLevels.length === 0
  && props.modelValue.targetCategories.length === 0
)

const hasActiveFilters = computed(() => !allSelected.value)

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

function toggleWcag(level: 'A' | 'AA' | 'AAA') {
  const levels = [...props.modelValue.wcagLevels]
  const idx = levels.indexOf(level)
  if (idx >= 0) levels.splice(idx, 1)
  else levels.push(level)
  emit('update:modelValue', { ...props.modelValue, wcagLevels: levels })
}

function toggleTargetCategory(category: IssueTargetCategory) {
  const categories = [...props.modelValue.targetCategories]
  const idx = categories.indexOf(category)
  if (idx >= 0) categories.splice(idx, 1)
  else categories.push(category)
  emit('update:modelValue', { ...props.modelValue, targetCategories: categories })
}

type FilterMenuItem = {
  label: string
  type: 'checkbox'
  checked: boolean
  onUpdateChecked: (checked: boolean) => void
  onSelect: (e: Event) => void
}

const filterMenuItems = computed((): FilterMenuItem[][] => [
  [
    {
      label: `All (${openIssues.value.length})`,
      type: 'checkbox',
      checked: allSelected.value,
      onUpdateChecked(checked: boolean) {
        if (checked) selectAll()
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    },
    {
      label: `Critical (${countImpact('critical') + countImpact('serious')})`,
      type: 'checkbox',
      checked: isImpactActive('critical'),
      onUpdateChecked() {
        toggleImpact('critical')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    },
    {
      label: `Moderate (${countImpact('moderate')})`,
      type: 'checkbox',
      checked: isImpactActive('moderate'),
      onUpdateChecked() {
        toggleImpact('moderate')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    },
    {
      label: `Minor (${countImpact('minor')})`,
      type: 'checkbox',
      checked: isImpactActive('minor'),
      onUpdateChecked() {
        toggleImpact('minor')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }
  ],
  [
    {
      label: `AA (${countWcag('AA')})`,
      type: 'checkbox',
      checked: props.modelValue.wcagLevels.includes('AA'),
      onUpdateChecked() {
        toggleWcag('AA')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    },
    {
      label: `AAA (${countWcag('AAA')})`,
      type: 'checkbox',
      checked: props.modelValue.wcagLevels.includes('AAA'),
      onUpdateChecked() {
        toggleWcag('AAA')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    },
    {
      label: `A (${countWcag('A')})`,
      type: 'checkbox',
      checked: props.modelValue.wcagLevels.includes('A'),
      onUpdateChecked() {
        toggleWcag('A')
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }
  ],
  TARGET_CATEGORY_OPTIONS.map((category) => ({
    label: `${issueTargetCategoryLabel(category)} (${countTargetCategory(category)})`,
    type: 'checkbox' as const,
    checked: props.modelValue.targetCategories.includes(category),
    onUpdateChecked() {
      toggleTargetCategory(category)
    },
    onSelect(e: Event) {
      e.preventDefault()
    }
  }))
])
</script>

<template>
  <UDropdownMenu
    :items="filterMenuItems"
    :content="{ align: 'end' }"
  >
    <TableToolbarMenuButton
      label="Filters"
      icon="i-lucide-list-filter"
      :active-ring="hasActiveFilters"
      aria-label="Filter issues by severity, WCAG level, and check type"
    />
  </UDropdownMenu>
</template>
