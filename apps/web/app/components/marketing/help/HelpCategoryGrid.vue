<script setup lang="ts">
import type { HelpCatalogCategory } from '~/utils/help'

defineProps<{
  categories: HelpCatalogCategory[]
}>()
</script>

<template>
  <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <li
      v-for="category in categories"
      :key="category.id"
    >
      <NuxtLink
        :to="`/help/${category.id}`"
        class="group flex h-full flex-col rounded-2xl border border-default/80 bg-elevated/20 p-5 transition hover:border-primary/40 hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div class="mb-3 flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon
              :name="category.icon"
              class="size-5"
            />
          </span>
          <h2 class="text-base font-semibold text-highlighted group-hover:text-primary">
            {{ category.label }}
          </h2>
        </div>
        <p class="flex-1 text-sm leading-relaxed text-muted">
          {{ category.description }}
        </p>
        <p class="mt-4 text-xs font-medium text-muted">
          {{ category.articleCount }}
          {{ category.articleCount === 1 ? 'article' : 'articles' }}
        </p>
      </NuxtLink>
    </li>
  </ul>
</template>
