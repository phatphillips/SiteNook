<script setup lang="ts">
const props = defineProps<{
  count: number
  editDisabled?: boolean
  removeDisabled?: boolean
}>()

const emit = defineEmits<{
  edit: []
  remove: []
}>()

const recordLabel = computed(() => (props.count === 1 ? 'record' : 'records'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="count > 0"
      class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-default bg-default px-5 py-2.5 shadow-lg shadow-black/10"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <p class="text-sm text-muted whitespace-nowrap">
        Selected <span class="font-semibold text-highlighted">{{ count }}</span> {{ recordLabel }}
      </p>

      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="editDisabled || count !== 1"
        @click="emit('edit')"
      >
        Edit
      </UButton>

      <UButton
        color="error"
        variant="link"
        size="sm"
        class="font-medium"
        :disabled="removeDisabled"
        @click="emit('remove')"
      >
        Remove selected
      </UButton>
    </div>
  </Teleport>
</template>
