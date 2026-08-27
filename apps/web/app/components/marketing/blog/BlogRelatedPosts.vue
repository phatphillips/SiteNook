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
  <section class="mt-16 border-t border-default/60 pt-12">
    <div class="mb-6 flex items-end justify-between gap-4">
      <h2 class="text-xl font-semibold tracking-tight text-highlighted">
        Related posts
      </h2>
      <NuxtLink
        to="/blog"
        class="text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        View more posts →
      </NuxtLink>
    </div>

    <ul class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="post in posts"
        :key="post.path"
      >
        <NuxtLink
          :to="post.path"
          class="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <p class="text-xs text-muted">
            <time :datetime="post.date">{{ formatBlogDate(post.date) }}</time>
            <span aria-hidden="true"> · </span>
            <span class="capitalize">{{ categoryLabel(post.category) }}</span>
          </p>
          <h3 class="mt-2 text-base font-semibold tracking-tight text-highlighted group-hover:text-primary">
            {{ post.title }}
          </h3>
          <p class="mt-2 text-xs text-muted">
            {{ formatAuthors(post.authors) }}
            <span aria-hidden="true"> · </span>
            {{ formatReadingTime(readingTimeMinutes(bodyTextFromPost(post))) }}
          </p>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
