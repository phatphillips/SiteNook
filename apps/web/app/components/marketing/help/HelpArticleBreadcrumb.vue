<script setup lang="ts">
import { helpCategoryLabel } from '~/utils/help'

defineProps<{
  category: string
  title: string
  categoryHref?: string
}>()
</script>

<template>
  <nav
    class="mb-8 text-sm text-muted"
    aria-label="Breadcrumb"
  >
    <ol class="flex flex-wrap items-center gap-1.5">
      <li>
        <NuxtLink
          to="/help"
          class="hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Help
        </NuxtLink>
      </li>
      <li aria-hidden="true">
        /
      </li>
      <li>
        <NuxtLink
          :to="categoryHref || `/help/${category}`"
          class="hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {{ helpCategoryLabel(category) }}
        </NuxtLink>
      </li>
      <template v-if="title">
        <li aria-hidden="true">
          /
        </li>
        <li class="text-highlighted">
          {{ title }}
        </li>
      </template>
    </ol>
  </nav>
</template>
