<script setup lang="ts">
import type { SerpDevice } from '~/utils/serpPreview'
import {
  formatSerpDate,
  hostnameFromUrl,
  serpDescriptionPreview,
  serpTitlePreview
} from '~/utils/serpPreview'

const props = defineProps<{
  url: string
  title: string
  metaDescription: string
  device: SerpDevice
  descriptionMax?: number
  showDate: boolean
  showFavicon: boolean
  faviconUrl?: string
  lastModified?: string | null
}>()

const displayTitle = computed(() =>
  serpTitlePreview(props.title || 'Page Title', props.device)
)

const dateLabel = computed(() =>
  props.showDate ? formatSerpDate(props.lastModified) : null
)

const displayDescription = computed(() => {
  const desc = props.metaDescription.trim()
  if (!desc) {
    return 'No meta description found. Google may use page body text instead.'
  }
  return serpDescriptionPreview(desc, props.device, {
    includeDate: props.showDate && !!dateLabel.value,
    dateLabel: dateLabel.value ?? undefined
  })
})

const hasMetaDescription = computed(() => props.metaDescription.trim().length > 0)

const hostname = computed(() => hostnameFromUrl(props.url || 'https://example.com'))
</script>

<template>
  <div
    class="serp-card rounded-lg bg-white p-4 sm:p-5 shadow-sm border border-gray-200 w-full transition-[background-color,color] duration-200 dark:bg-[#202124] dark:border-gray-700"
  >
    <div class="flex items-center gap-2 mb-1">
      <img
        v-if="showFavicon && faviconUrl"
        :src="faviconUrl"
        alt=""
        class="size-4 rounded-full"
      >
      <span
        v-else-if="showFavicon"
        class="size-4 rounded-full bg-gray-200 shrink-0 dark:bg-gray-600"
      />
      <span class="text-sm text-[#202124] transition-colors duration-200 dark:text-[#bdc1c6]">
        {{ hostname }}
      </span>
    </div>
    <p class="text-xl text-[#1a0dab] leading-snug mb-1 line-clamp-2 transition-colors duration-200 dark:text-[#8ab4f8]">
      {{ displayTitle }}
    </p>
    <p
      class="text-sm leading-relaxed line-clamp-2 transition-colors duration-200"
      :class="hasMetaDescription
        ? 'text-[#202124] dark:text-[#bdc1c6]'
        : 'text-gray-400 italic dark:text-[#bdc1c6]/70'"
    >
      {{ displayDescription }}
    </p>
  </div>
</template>
