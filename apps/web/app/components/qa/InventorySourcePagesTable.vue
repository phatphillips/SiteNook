<script setup lang="ts">
import type { InventorySourcePageSummary } from '~/types/sitenook'
import { pageDisplayTitle } from '~/utils/affectedPages'

const props = withDefaults(defineProps<{
  pages: InventorySourcePageSummary[]
  loading?: boolean
}>(), {
  loading: false
})
</script>

<template>
  <div class="inventory-source-pages space-y-2">
    <p class="text-xs font-medium text-muted">
      Pages where this asset was found
    </p>

    <div
      v-if="loading && !pages.length"
      class="rounded-md border border-default bg-elevated/30 px-4 py-6 text-sm text-muted"
    >
      Loading pages…
    </div>

    <div
      v-else-if="pages.length"
      class="rounded-md border border-default overflow-hidden bg-elevated/30"
    >
      <ul class="divide-y divide-default">
        <li
          v-for="page in pages"
          :key="page.url"
          class="px-3 py-2.5 hover:bg-elevated/40"
        >
          <a
            :href="page.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-medium text-primary hover:underline line-clamp-2"
            :title="pageDisplayTitle(page)"
          >
            {{ pageDisplayTitle(page) }}
          </a>
          <p
            class="text-xs text-muted truncate mt-0.5"
            :title="page.url"
          >
            {{ page.url }}
          </p>
        </li>
      </ul>
    </div>

    <p
      v-else
      class="text-sm text-muted"
    >
      No source pages recorded. Re-scan this site to populate page references.
    </p>
  </div>
</template>
