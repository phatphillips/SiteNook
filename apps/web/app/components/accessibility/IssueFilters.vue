<script setup lang="ts">
import type { IssueFilters } from '~/types/accessiq'

const props = defineProps<{
  modelValue: IssueFilters
  totalCount: number
  filteredCount: number
}>()

const emit = defineEmits<{ 'update:modelValue': [IssueFilters] }>()

const filterOptions = {
  wcagVersions: ['2.0', '2.1', '2.2'],
  impacts: ['critical', 'serious', 'moderate', 'minor'],
  types: ['error', 'warning', 'review'],
  elements: ['image', 'form', 'link', 'heading', 'table', 'media', 'aria', 'other'],
  roles: ['developer', 'editor', 'designer'],
  statuses: ['open', 'dismissed', 'fixed']
}

function toggle(key: keyof IssueFilters, value: string) {
  const current = [...props.modelValue[key]]
  const idx = current.indexOf(value)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(value)
  emit('update:modelValue', { ...props.modelValue, [key]: current })
}

function clearAll() {
  emit('update:modelValue', {
    wcagVersions: [],
    impacts: [],
    types: [],
    elements: [],
    roles: [],
    statuses: ['open']
  })
}

const hasActiveFilters = computed(() =>
  props.modelValue.wcagVersions.length > 0
  || props.modelValue.impacts.length > 0
  || props.modelValue.types.length > 0
  || props.modelValue.elements.length > 0
  || props.modelValue.roles.length > 0
  || (props.modelValue.statuses.length !== 1 || props.modelValue.statuses[0] !== 'open')
)

const activeChips = computed(() => {
  const chips: Array<{ key: keyof IssueFilters, value: string }> = []
  for (const [key, values] of Object.entries(props.modelValue) as [keyof IssueFilters, string[]][]) {
    for (const value of values) {
      if (key === 'statuses' && value === 'open' && values.length === 1) continue
      chips.push({ key, value })
    }
  }
  return chips
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <USelectMenu
        :model-value="modelValue.impacts"
        :items="filterOptions.impacts"
        multiple
        placeholder="Impact"
        class="w-36"
        @update:model-value="emit('update:modelValue', { ...modelValue, impacts: $event as string[] })"
      />
      <USelectMenu
        :model-value="modelValue.types"
        :items="filterOptions.types"
        multiple
        placeholder="Type"
        class="w-36"
        @update:model-value="emit('update:modelValue', { ...modelValue, types: $event as string[] })"
      />
      <USelectMenu
        :model-value="modelValue.elements"
        :items="filterOptions.elements"
        multiple
        placeholder="Element"
        class="w-36"
        @update:model-value="emit('update:modelValue', { ...modelValue, elements: $event as string[] })"
      />
      <USelectMenu
        :model-value="modelValue.roles"
        :items="filterOptions.roles"
        multiple
        placeholder="Role"
        class="w-36"
        @update:model-value="emit('update:modelValue', { ...modelValue, roles: $event as string[] })"
      />
      <USelectMenu
        :model-value="modelValue.statuses"
        :items="filterOptions.statuses"
        multiple
        placeholder="Status"
        class="w-36"
        @update:model-value="emit('update:modelValue', { ...modelValue, statuses: $event as string[] })"
      />
    </div>

    <div v-if="activeChips.length" class="flex flex-wrap items-center gap-2">
      <UBadge
        v-for="chip in activeChips"
        :key="`${chip.key}-${chip.value}`"
        variant="subtle"
        class="cursor-pointer"
        @click="toggle(chip.key, chip.value)"
      >
        {{ chip.value }} ×
      </UBadge>
      <UButton variant="link" size="xs" @click="clearAll">Clear all filters</UButton>
    </div>

    <p class="text-sm text-muted">
      Showing {{ filteredCount }} of {{ totalCount }} issues
    </p>
  </div>
</template>
