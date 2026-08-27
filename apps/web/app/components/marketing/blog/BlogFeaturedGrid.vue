<script setup lang="ts">
import type { BlogListItem } from '~/utils/blog'
import {
  bodyTextFromPost,
  categoryLabel,
  formatAuthors,
  formatBlogDate,
  formatReadingTime,
  readingTimeMinutes
} from '~/utils/blog'

defineProps<{
  posts: BlogListItem[]
}>()
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    <NuxtLink
      v-for="post in posts"
      :key="post.path"
      :to="post.path"
      class="group flex flex-col overflow-hidden rounded-2xl border border-default/80 bg-default ring-1 ring-default/40 transition-shadow hover:shadow-lg hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div class="aspect-[16/10] overflow-hidden bg-elevated/40">
        <img
          :src="post.image"
          :alt="''"
          class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        >
      </div>
      <div class="flex flex-1 flex-col gap-3 p-5">
        <p class="text-xs text-muted">
          <time :datetime="post.date">{{ formatBlogDate(post.date) }}</time>
          <span aria-hidden="true"> · </span>
          <span class="capitalize">{{ categoryLabel(post.category) }}</span>
        </p>
        <h2 class="text-lg font-semibold tracking-tight text-highlighted group-hover:text-primary">
          {{ post.title }}
        </h2>
        <p class="line-clamp-3 text-sm leading-relaxed text-muted">
          {{ post.description }}
        </p>
        <p class="mt-auto pt-2 text-xs text-muted">
          {{ formatAuthors(post.authors) }}
          <span aria-hidden="true"> · </span>
          {{ formatReadingTime(readingTimeMinutes(bodyTextFromPost(post))) }}
        </p>
      </div>
    </NuxtLink>
  </div>
</template>
