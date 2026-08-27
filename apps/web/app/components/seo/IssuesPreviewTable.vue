<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import { uniqueSeoByRule } from '~/utils/seoIssues'

const props = withDefaults(defineProps<{
  issues: SeoIssue[]
  loading?: boolean
  siteId: string
  title: string
  footerTo: string
  footerLabel: string
  emptyLabel: string
}>(), {
  loading: false
})

const emit = defineEmits<{
  select: [issue: SeoIssue]
}>()

const previewIssues = computed(() => uniqueSeoByRule(props.issues).slice(0, 8))
</script>

<template>
  <div class="table-surface">
    <div class="border-b border-default px-4 py-3">
      <h3 class="text-sm font-medium text-default">
        {{ title }}
      </h3>
    </div>

    <div v-if="loading && !issues.length" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <template v-else-if="previewIssues.length">
      <SeoIssueTable
        :issues="previewIssues"
        embedded
        @select="emit('select', $event)"
      />
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2">
        <p class="text-xs text-muted">
          Showing top {{ previewIssues.length }} issue{{ previewIssues.length === 1 ? '' : 's' }}
        </p>
        <TableFooterLinkButton
          :to="footerTo"
          :label="footerLabel"
        />
      </div>
    </template>

    <p v-else class="px-4 py-6 text-center text-sm text-muted">
      {{ emptyLabel }}
    </p>
  </div>
</template>
