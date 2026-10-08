<script setup lang="ts">
import type { SerpPagePickerItem } from '~/utils/serpPreview'

const props = defineProps<{
  /** Prebuilt items when value is not a bare page URL (e.g. org composite keys). */
  items?: SerpPagePickerItem[]
  pages?: Array<{ url: string, title?: string | null }>
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const menuOpen = ref(false)

const resolvedItems = computed<SerpPagePickerItem[]>(() => {
  if (props.items?.length) return props.items
  return (props.pages ?? []).map((page) => {
    const title = page.title?.trim()
    return {
      label: title || page.url,
      description: title ? page.url : undefined,
      value: page.url
    }
  })
})

const selected = computed({
  get: () => props.modelValue,
  set: (value: string | null | undefined) => {
    menuOpen.value = false
    if (typeof value === 'string' && value) {
      emit('update:modelValue', value)
    }
  }
})
</script>

<template>
  <UFormField label="Page">
    <USelectMenu
      v-if="resolvedItems.length"
      v-model="selected"
      v-model:open="menuOpen"
      :items="resolvedItems"
      value-key="value"
      placeholder="Select a crawled page…"
      class="w-full"
      @update:model-value="menuOpen = false"
    />
    <p v-else class="text-sm text-muted">
      No pages in the latest scan. Run a scan to populate page data.
    </p>
  </UFormField>
</template>
