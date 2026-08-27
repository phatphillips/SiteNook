<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import type { SiteFileRow } from '~/utils/crawlAuditDisplay'
import { buildSiteFileRows } from '~/utils/crawlAuditDisplay'
import type { SeoCrawlAudit } from '~/types/sitenook'

const props = defineProps<{
  audit?: SeoCrawlAudit | null
  issues?: SeoIssue[]
}>()

const emit = defineEmits<{
  'view-issue': [issue: SeoIssue]
}>()

const rows = computed(() =>
  buildSiteFileRows(props.audit, props.issues ?? [])
)

function actionLabel(row: SiteFileRow): string {
  if (row.linkedIssue) return 'View issue'
  if (row.key === 'llms' && !row.found) return 'How to add'
  return ''
}

function onAction(row: SiteFileRow) {
  if (row.linkedIssue) {
    emit('view-issue', row.linkedIssue)
  } else if (row.key === 'llms' && !row.found) {
    emit('view-issue', {
      id: 'llms-help',
      rule_id: 'llms-missing',
      category: 'technical',
      subcategory: 'crawlability',
      severity: 'moderate',
      status: 'open',
      title: 'llms.txt not found',
      description: 'llms.txt helps AI crawlers understand your site.',
      recommendation: 'Add /llms.txt with a site summary and links to key pages.',
      scan: '',
      site: ''
    } as SeoIssue)
  }
}
</script>

<template>
  <UCard v-if="rows.length" :ui="{ body: 'p-4 sm:p-6' }">
    <h3 class="text-sm font-medium mb-4">Site files</h3>
    <ul class="space-y-4">
      <li
        v-for="row in rows"
        :key="row.key"
        class="border-b border-default last:border-0 pb-4 last:pb-0"
      >
        <div class="flex items-start gap-2">
          <TrafficLightDot :status="row.status" class="mt-1" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span class="font-medium text-sm">{{ row.label }}</span>
              <span class="text-xs text-muted">
                {{ row.found ? 'Found' : 'Missing' }}
              </span>
            </div>
            <a
              v-if="row.url"
              :href="row.url"
              target="_blank"
              rel="noopener"
              class="text-xs text-primary hover:underline break-all"
            >
              {{ row.url }}
            </a>
            <p class="text-sm text-muted mt-1">{{ row.summary }}</p>
            <UButton
              v-if="actionLabel(row)"
              variant="link"
              size="xs"
              class="px-0 mt-1"
              @click="onAction(row)"
            >
              {{ actionLabel(row) }} →
            </UButton>
          </div>
        </div>
      </li>
    </ul>
  </UCard>
</template>
