<script setup lang="ts">
import type { MarketingFaqItem } from '~/utils/marketingFaq'

const props = defineProps<{
  title?: string
  description?: string
  items: MarketingFaqItem[]
}>()

const accordionItems = computed(() =>
  props.items.map((item, index) => ({
    label: item.label,
    content: item.content,
    value: `faq-${index}`
  }))
)
</script>

<template>
  <section class="border-t border-default/60">
    <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ title || 'Frequently asked questions' }}
      </h2>
      <p v-if="description" class="mt-3 text-muted">
        {{ description }}
      </p>
      <UAccordion
        class="mt-8"
        type="multiple"
        :items="accordionItems"
        :ui="{
          trigger: 'min-h-11 py-3 text-left text-base font-medium text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          body: 'text-sm leading-relaxed text-muted'
        }"
      />
    </div>
  </section>
</template>
