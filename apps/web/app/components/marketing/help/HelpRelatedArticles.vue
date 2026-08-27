<script setup lang="ts">
import type { HelpArticleSummary } from '~/utils/help'

defineProps<{
  articles: HelpArticleSummary[]
  heading?: string
}>()
</script>

<template>
  <section
    v-if="articles.length"
    class="mt-14 border-t border-default/60 pt-10"
  >
    <h2 class="text-lg font-semibold tracking-tight text-highlighted">
      {{ heading || 'Related articles' }}
    </h2>
    <ul class="mt-4 space-y-3">
      <li
        v-for="article in articles"
        :key="article.path"
      >
        <NuxtLink
          :to="article.path"
          class="group block rounded-xl border border-transparent px-3 py-2 hover:border-default/80 hover:bg-elevated/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span class="font-medium text-highlighted group-hover:text-primary">
            {{ article.title }}
          </span>
          <p
            v-if="article.description"
            class="mt-0.5 text-sm text-muted"
          >
            {{ article.description }}
          </p>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
