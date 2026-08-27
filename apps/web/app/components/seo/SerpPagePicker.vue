<script setup lang="ts">
import type { PageRecord } from '~/types/sitenook'

const props = defineProps<{
  pages: PageRecord[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const items = computed(() =>
  props.pages.map(page => ({
    label: page.url,
    value: page.url
  }))
)

const selected = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})
</script>

<template>
  <UFormField label="Page">
    <USelectMenu
      v-if="items.length"
      v-model="selected"
      :items="items"
      value-key="value"
      placeholder="Select a crawled page…"
      class="w-full"
    />
    <p v-else class="text-sm text-muted">
      No pages in the latest scan. Run a scan to populate page data.
    </p>
  </UFormField>
</template>
