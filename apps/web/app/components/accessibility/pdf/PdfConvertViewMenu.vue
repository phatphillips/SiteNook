<script setup lang="ts">
import type { PdfInspectorPaneView } from '~/utils/pdfStructureViews'
import { PDF_CONVERT_PANE_OPTIONS } from '~/utils/pdfStructureViews'

const props = defineProps<{
  modelValue: PdfInspectorPaneView
}>()

const emit = defineEmits<{
  'update:modelValue': [PdfInspectorPaneView]
}>()

const open = ref(false)

const selectedLabel = computed(() =>
  PDF_CONVERT_PANE_OPTIONS.find(o => o.value === props.modelValue)?.label ?? 'View'
)

function selectView(value: PdfInspectorPaneView) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'end', side: 'bottom' }"
  >
    <UButton
      size="xs"
      color="neutral"
      variant="outline"
      trailing-icon="i-lucide-chevron-down"
      class="min-w-32 justify-between"
    >
      {{ selectedLabel }}
    </UButton>

    <template #content>
      <div class="flex w-48 flex-col gap-0.5 p-2">
        <button
          v-for="option in PDF_CONVERT_PANE_OPTIONS"
          :key="option.value"
          type="button"
          class="rounded-md px-2 py-1.5 text-left text-xs hover:bg-elevated"
          :class="modelValue === option.value ? 'bg-elevated font-medium text-highlighted' : 'text-muted'"
          @click="selectView(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </template>
  </UPopover>
</template>
