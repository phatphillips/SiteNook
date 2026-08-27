<script setup lang="ts">
import type { SiteDashboardSnapshot } from '~/utils/dashboardAggregates'

defineProps<{
  sites: SiteDashboardSnapshot[]
  scoreField: 'accessibilityScore' | 'qaScore' | 'seoScore'
  issueField: 'openA11yIssues' | 'openQaIssues' | 'openSeoIssues'
  issueLabel?: string
  emptyLabel?: string
}>()
</script>

<template>
  <div class="min-w-0">
    <p class="mb-3 text-sm font-medium text-highlighted">
      Sites needing attention
    </p>
    <ul v-if="sites.length" class="divide-y divide-default rounded-lg border border-default">
      <li
        v-for="site in sites"
        :key="site.siteId"
        class="flex items-center gap-3 px-4 py-3"
      >
        <NuxtLink
          :to="`/sites/${site.siteId}`"
          class="min-w-0 flex-1 truncate font-medium text-highlighted hover:text-primary"
        >
          {{ site.siteName }}
        </NuxtLink>
        <span class="shrink-0 text-sm tabular-nums text-muted">
          {{ site[scoreField] ?? '—' }}
        </span>
        <span class="shrink-0 text-sm tabular-nums text-muted">
          {{ site[issueField] }} {{ issueLabel ?? 'issues' }}
        </span>
      </li>
    </ul>
    <p v-else class="py-4 text-sm text-muted">
      {{ emptyLabel ?? 'No sites with scan data yet.' }}
    </p>
  </div>
</template>
