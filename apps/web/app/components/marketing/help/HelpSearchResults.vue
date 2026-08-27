<script setup lang="ts">
import type { HelpSearchHit } from '~/utils/help'

defineProps<{
  hits: HelpSearchHit[]
  query: string
  unavailable?: boolean
  loading?: boolean
}>()
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="py-10 text-center text-sm text-muted"
    >
      Searching…
    </div>

    <div
      v-else-if="unavailable"
      class="rounded-2xl border border-default/80 bg-elevated/20 px-6 py-10 text-center"
      role="status"
    >
      <p class="text-base font-medium text-highlighted">
        Search temporarily unavailable
      </p>
      <p class="mt-2 text-sm text-muted">
        Clear the search box to browse categories, or try again shortly.
      </p>
    </div>

    <div
      v-else-if="!hits.length"
      class="rounded-2xl border border-default/80 bg-elevated/20 px-6 py-10 text-center"
      role="status"
    >
      <p class="text-base font-medium text-highlighted">
        No results
      </p>
      <p class="mt-2 text-sm text-muted">
        No help articles matched “{{ query }}”. Try different keywords.
      </p>
    </div>

    <ul
      v-else
      class="divide-y divide-default/60 rounded-2xl border border-default/80"
    >
      <li
        v-for="hit in hits"
        :key="hit.path"
      >
        <NuxtLink
          :to="hit.path"
          class="block px-5 py-4 transition hover:bg-elevated/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ hit.categoryLabel }}
          </p>
          <h2 class="mt-1 text-base font-semibold text-highlighted">
            {{ hit.title }}
          </h2>
          <p class="mt-1 line-clamp-2 text-sm text-muted">
            {{ hit.snippet || hit.description }}
          </p>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
