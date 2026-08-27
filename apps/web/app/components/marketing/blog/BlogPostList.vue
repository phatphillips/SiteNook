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
  <ul class="divide-y divide-default/70 border-t border-default/70">
    <li
      v-for="post in posts"
      :key="post.path"
    >
      <NuxtLink
        :to="post.path"
        class="group flex flex-col gap-1 py-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
      >
        <div class="min-w-0 flex-1">
          <p class="text-xs text-muted">
            <time :datetime="post.date">{{ formatBlogDate(post.date) }}</time>
            <span aria-hidden="true"> · </span>
            <span class="capitalize">{{ categoryLabel(post.category) }}</span>
          </p>
          <h3 class="mt-1.5 text-base font-semibold tracking-tight text-highlighted group-hover:text-primary sm:text-lg">
            {{ post.title }}
          </h3>
        </div>
        <p class="shrink-0 text-xs text-muted sm:text-right sm:text-sm">
          {{ formatAuthors(post.authors) }}
          <span class="hidden sm:inline" aria-hidden="true"> · </span>
          <span class="block sm:inline">
            {{ formatReadingTime(readingTimeMinutes(bodyTextFromPost(post))) }}
          </span>
        </p>
      </NuxtLink>
    </li>
  </ul>
  <p
    v-if="!posts.length"
    class="border-t border-default/70 py-10 text-sm text-muted"
  >
    No posts in this category yet.
  </p>
</template>
