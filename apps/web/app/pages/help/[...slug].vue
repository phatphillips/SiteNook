<script setup lang="ts">
import type { HelpArticleSummary, HelpCategoryMeta } from '~/utils/help'

definePageMeta({
  middleware: 'marketing-public'
})

interface HelpArticleDetail extends HelpArticleSummary {
  type: 'article'
  bodyHtml: string
  related: HelpArticleSummary[]
}

interface HelpCategoryDetail {
  type: 'category'
  category: HelpCategoryMeta
  articles: HelpArticleSummary[]
}

type HelpSlugResponse = HelpArticleDetail | HelpCategoryDetail

const route = useRoute()
const slugKey = computed(() => {
  const raw = route.params.slug
  if (Array.isArray(raw)) return raw.join('/')
  return String(raw || '')
})

const { data, error } = await useAsyncData(
  () => `help-slug-${slugKey.value}`,
  () => $fetch<HelpSlugResponse>(`/api/help/articles/${slugKey.value}`),
  { watch: [slugKey] }
)

if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const article = computed(() =>
  data.value?.type === 'article' ? data.value : null
)
const categoryPage = computed(() =>
  data.value?.type === 'category' ? data.value : null
)

useSeoMeta({
  title: () => {
    if (article.value) return article.value.title
    if (categoryPage.value) return categoryPage.value.category.label
    return 'Help'
  },
  description: () => {
    if (article.value) return article.value.description
    if (categoryPage.value) return categoryPage.value.category.description
    return ''
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
    <template v-if="categoryPage">
      <HelpArticleBreadcrumb
        :category="categoryPage.category.id"
        title=""
      />
      <header class="mb-10">
        <div class="mb-4 flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon
              :name="categoryPage.category.icon"
              class="size-5"
            />
          </span>
          <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
            {{ categoryPage.category.label }}
          </h1>
        </div>
        <p class="text-lg leading-relaxed text-muted">
          {{ categoryPage.category.description }}
        </p>
      </header>
      <ul class="space-y-3">
        <li
          v-for="item in categoryPage.articles"
          :key="item.path"
        >
          <NuxtLink
            :to="item.path"
            class="group block rounded-2xl border border-default/80 px-5 py-4 transition hover:border-primary/40 hover:bg-elevated/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <h2 class="font-semibold text-highlighted group-hover:text-primary">
              {{ item.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ item.description }}
            </p>
          </NuxtLink>
        </li>
      </ul>
    </template>

    <article v-else-if="article">
      <HelpArticleBreadcrumb
        :category="article.category"
        :title="article.title"
      />
      <header class="mb-8">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
          {{ article.title }}
        </h1>
        <p class="mt-4 text-lg leading-relaxed text-muted">
          {{ article.description }}
        </p>
      </header>
      <BlogProse>
        <!-- Trusted in-repo Markdown converted server-side -->
        <div v-html="article.bodyHtml" />
      </BlogProse>
      <HelpRelatedArticles :articles="article.related" />
    </article>
  </div>
</template>
