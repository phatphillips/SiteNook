<script setup lang="ts">
/**
 * Sortable column header — matches Content Explorer (UButton ghost sm + hover).
 * Imported by `dataTableSortableHeader` so UIcon resolves (resolveComponent in a util does not).
 */
const props = withDefaults(defineProps<{
  label: string
  sorted?: false | 'asc' | 'desc'
  align?: 'left' | 'right' | 'center'
}>(), {
  sorted: false,
  align: 'left'
})

defineEmits<{
  click: []
}>()

const sortIcon = computed(() => {
  if (props.sorted === 'asc') return 'i-lucide-arrow-up-narrow-wide'
  if (props.sorted === 'desc') return 'i-lucide-arrow-down-wide-narrow'
  return 'i-lucide-arrow-up-down'
})
</script>

<template>
  <div
    v-if="align !== 'left'"
    :class="align === 'right' ? 'flex justify-end' : 'flex justify-center'"
  >
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      :label="label"
      :trailing-icon="sortIcon"
      class="data-table-sort-btn"
      @click="$emit('click')"
    />
  </div>
  <UButton
    v-else
    color="neutral"
    variant="ghost"
    size="sm"
    :label="label"
    :trailing-icon="sortIcon"
    class="data-table-sort-btn -mx-2.5"
    @click="$emit('click')"
  />
</template>
