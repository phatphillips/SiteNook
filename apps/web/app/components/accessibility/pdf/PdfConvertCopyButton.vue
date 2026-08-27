<script setup lang="ts">
import {
  buildPdfConvertClipboardText,
  readLlmPromptEnabled,
  writeLlmPromptEnabled
} from '~/utils/pdfConvertCopy'

const props = defineProps<{
  disabled?: boolean
  getText: () => string
}>()

const toast = useToast()
const includeLlmPrompt = ref(false)

onMounted(() => {
  includeLlmPrompt.value = readLlmPromptEnabled()
})

const copyMenuItems = computed(() => [[
  {
    label: 'Copy raw text',
    icon: includeLlmPrompt.value ? undefined : 'i-lucide-check',
    onSelect: () => { void copyWithMode(false) }
  },
  {
    label: 'Copy with LLM prompt',
    icon: includeLlmPrompt.value ? 'i-lucide-check' : undefined,
    onSelect: () => { void copyWithMode(true) }
  }
]])

async function copyWithMode(withPrompt: boolean) {
  includeLlmPrompt.value = withPrompt
  writeLlmPromptEnabled(withPrompt)
  const content = props.getText()
  const text = buildPdfConvertClipboardText(content, withPrompt)
  if (!text) {
    toast.add({ title: 'Nothing to copy', color: 'warning' })
    return
  }
  await navigator.clipboard.writeText(text)
  toast.add({
    title: withPrompt ? 'Copied with LLM prompt' : 'Copied raw text',
    color: 'success'
  })
}

function onPrimaryCopy() {
  void copyWithMode(includeLlmPrompt.value)
}
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-md shadow-xs"
    role="group"
    aria-label="Copy options"
  >
    <UButton
      size="xs"
      color="neutral"
      variant="outline"
      icon="i-lucide-copy"
      label="Copy"
      class="rounded-e-none border-e-0"
      :disabled="disabled"
      @click="onPrimaryCopy"
    />
    <UDropdownMenu
      :items="copyMenuItems"
      :content="{ align: 'end' }"
      :disabled="disabled"
    >
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        icon="i-lucide-chevron-down"
        class="rounded-s-none px-1.5"
        :disabled="disabled"
        aria-label="Copy options"
      />
    </UDropdownMenu>
  </div>
</template>
