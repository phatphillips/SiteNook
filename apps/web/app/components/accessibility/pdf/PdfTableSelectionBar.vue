<script setup lang="ts">
const props = defineProps<{
  count: number
  scanDisabled?: boolean
  removeDisabled?: boolean
  scanning?: boolean
  removing?: boolean
}>()

const emit = defineEmits<{
  scan: []
  remove: []
  clear: []
}>()

const pdfLabel = computed(() => (props.count === 1 ? 'PDF' : 'PDFs'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="count > 0"
      class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-default bg-default px-5 py-2.5 shadow-lg shadow-black/10"
      role="toolbar"
      aria-label="PDF bulk actions"
    >
      <p class="text-sm text-muted whitespace-nowrap">
        Selected <span class="font-semibold text-highlighted">{{ count }}</span> {{ pdfLabel }}
      </p>

      <UButton
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-refresh-cw"
        label="Scan selected"
        :disabled="scanDisabled"
        :loading="scanning"
        @click="emit('scan')"
      />

      <UButton
        color="error"
        variant="link"
        size="sm"
        class="font-medium"
        icon="i-lucide-trash-2"
        label="Remove selected"
        :disabled="removeDisabled"
        :loading="removing"
        @click="emit('remove')"
      />

      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        label="Clear"
        @click="emit('clear')"
      />
    </div>
  </Teleport>
</template>
