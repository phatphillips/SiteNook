<script setup lang="ts">
import type { BlogListItem } from '~/utils/blog'
import {
  bodyTextFromPost,
  categoryLabel,
  readingTimeMinutes
} from '~/utils/blog'

definePageMeta({
  middleware: 'marketing-public'
})

interface BlogPostDetail extends BlogListItem {
  bodyHtml: string
  related: BlogListItem[]
}

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const { data: post, error } = await useAsyncData(
  () => `blog-post-${slug.value}`,
  () => $fetch<BlogPostDetail>(`/api/blog/${slug.value}`),
  { watch: [slug] }
)

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found' })
}

const minutes = computed(() =>
  readingTimeMinutes(bodyTextFromPost(post.value ?? {}))
)

useSeoMeta({
  title: () => post.value?.title ?? 'Blog',
  description: () => post.value?.description ?? ''
})
</script>

<template>
  <article v-if="post" class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <nav class="mb-8 text-sm text-muted" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-1.5">
        <li>
          <NuxtLink
            to="/blog"
            class="hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Blog
          </NuxtLink>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <NuxtLink
            to="/blog"
            class="capitalize hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {{ categoryLabel(post.category) }}
          </NuxtLink>
        </li>
      </ol>
    </nav>

    <header class="mb-8">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
        {{ post.title }}
      </h1>
      <p class="mt-4 text-lg leading-relaxed text-muted">
        {{ post.description }}
      </p>
      <BlogPostMeta
        class="mt-5"
        :date="post.date"
        :category="post.category"
        :authors="post.authors"
        :reading-minutes="minutes"
      />
    </header>

    <div
      v-if="post.image"
      class="mb-10 overflow-hidden rounded-2xl border border-default/80 bg-elevated/30 ring-1 ring-default/40"
    >
      <img
        :src="post.image"
        :alt="''"
        class="aspect-[16/9] w-full object-cover"
      >
    </div>

    <BlogProse>
      <!-- Trusted in-repo Markdown converted server-side -->
      <div v-html="post.bodyHtml" />
    </BlogProse>

    <BlogRelatedPosts
      v-if="post.related?.length"
      :posts="post.related"
    />
  </article>
</template>
