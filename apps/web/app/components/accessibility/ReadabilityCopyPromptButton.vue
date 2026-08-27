<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import {
  buildChatGptPromptUrl,
  buildClaudePromptUrl,
  buildReadabilityRewritePrompt
} from '~/utils/readabilityRewritePrompt'

const props = defineProps<{
  url?: string | null
  title?: string | null
  methodId: ReadabilityMethodId
  score: number | null
  disabled?: boolean
}>()

const toast = useToast()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })

const canUse = computed(() => Boolean(props.url?.trim()) && !props.disabled)

const prompt = computed(() => {
  const url = props.url?.trim()
  if (!url) return ''
  return buildReadabilityRewritePrompt({
    url,
    title: props.title,
    methodId: props.methodId,
    score: props.score
  })
})

const menuItems = computed<DropdownMenuItem[][]>(() => [[
  {
    label: 'Open in ChatGPT',
    icon: 'i-simple-icons:openai',
    to: buildChatGptPromptUrl(prompt.value),
    target: '_blank',
    disabled: !canUse.value
  },
  {
    label: 'Open in Claude',
    icon: 'i-simple-icons:anthropic',
    to: buildClaudePromptUrl(prompt.value),
    target: '_blank',
    disabled: !canUse.value
  }
]])

async function copyPrompt() {
  if (!canUse.value || !prompt.value) {
    toast.add({ title: 'Nothing to copy', color: 'warning' })
    return
  }
  await copy(prompt.value)
  toast.add({
    title: 'Prompt copied',
    icon: 'i-lucide-check-circle',
    color: 'success'
  })
}
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-md shadow-xs"
    role="group"
    aria-label="Copy readability rewrite prompt"
  >
    <UButton
      :label="copied ? 'Copied' : 'Copy prompt'"
      :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
      color="neutral"
      variant="outline"
      class="rounded-e-none border-e-0"
      :disabled="!canUse"
      :ui="{ leadingIcon: copied ? 'text-primary' : undefined }"
      @click="copyPrompt"
    />
    <UDropdownMenu
      :items="menuItems"
      :content="{ align: 'end' }"
      :ui="{ content: 'w-48' }"
      :disabled="!canUse"
    >
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-chevron-down"
        class="rounded-s-none px-1.5"
        :disabled="!canUse"
        aria-label="Open prompt in chat"
      />
    </UDropdownMenu>
  </div>
</template>
