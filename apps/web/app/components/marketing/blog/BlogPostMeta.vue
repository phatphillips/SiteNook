<script setup lang="ts">
import {
  categoryLabel,
  formatAuthors,
  formatBlogDate,
  formatReadingTime
} from '~/utils/blog'

withDefaults(defineProps<{
  date: string
  category: string
  authors: string[]
  readingMinutes?: number
  showCategory?: boolean
  size?: 'sm' | 'md'
}>(), {
  showCategory: true,
  size: 'md'
})
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted"
    :class="size === 'sm' ? 'text-xs' : 'text-sm'"
  >
    <time :datetime="date">{{ formatBlogDate(date) }}</time>
    <template v-if="showCategory">
      <span aria-hidden="true">·</span>
      <span class="capitalize">{{ categoryLabel(category) }}</span>
    </template>
    <span aria-hidden="true">·</span>
    <span>{{ formatAuthors(authors) }}</span>
    <template v-if="readingMinutes != null">
      <span aria-hidden="true">·</span>
      <span>{{ formatReadingTime(readingMinutes) }}</span>
    </template>
  </div>
</template>
