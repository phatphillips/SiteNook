<script setup lang="ts">
import type { SeoCrawlAudit, SeoIssue } from '~/types/sitenook'
import type { SeoIssueBreakdownRow, SeoIssueCategoryId } from '~/utils/seoIssueBreakdown'
import { seoCategoryGuide } from '~/utils/seoCategoryDetails'
import { uniqueSeoByRule } from '~/utils/seoIssues'
import { ruleLabel } from '~/utils/seoRules'

const props = defineProps<{
  open: boolean
  row: SeoIssueBreakdownRow | null
  technicalScore: number | null
  crawlabilityScore: number | null
  contentScore: number | null
  avgReadabilityScore: number | null
  previewIssues: SeoIssue[]
  crawlAudit?: SeoCrawlAudit | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  'view-issue': [issue: SeoIssue]
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const guide = computed(() =>
  props.row ? seoCategoryGuide(props.row.id) : null
)

const modalTitle = computed(() =>
  props.row ? props.row.label : 'Issue category'
)

const showSiteFiles = computed(() =>
  props.row?.id === 'crawlability' && !!props.crawlAudit
)

const categoryScore = computed(() => {
  if (!props.row) return null
  switch (props.row.id) {
    case 'technical':
      return props.technicalScore
    case 'crawlability':
      return props.crawlabilityScore
    case 'content':
      return props.contentScore
  }
})

const categoryIssues = computed(() => {
  if (!props.row) return [] as SeoIssue[]
  return props.previewIssues.filter((issue) => {
    if (props.row!.id === 'crawlability') {
      return issue.subcategory === 'crawlability'
    }
    if (props.row!.id === 'content') {
      return issue.category === 'content'
    }
    return issue.category === 'technical' && issue.subcategory !== 'crawlability'
  })
})

const focusItems = computed(() =>
  uniqueSeoByRule(categoryIssues.value).slice(0, 3).map(issue => ({
    id: issue.id,
    label: issue.title || ruleLabel(issue.rule_id),
    hint: issue.severity
  }))
)

const secondaryStats = computed(() => {
  if (!props.row) return [] as Array<{ label: string, value: string }>
  const stats: Array<{ label: string, value: string }> = [
    {
      label: 'Category score',
      value: categoryScore.value != null ? String(categoryScore.value) : '—'
    }
  ]
  if (props.row.id === 'content' && props.avgReadabilityScore != null) {
    stats.push({
      label: 'Avg readability',
      value: String(props.avgReadabilityScore)
    })
  }
  return stats
})

function countLabel(id: SeoIssueCategoryId, count: number): string {
  if (count === 1) {
    switch (id) {
      case 'technical':
        return 'technical issue'
      case 'crawlability':
        return 'crawlability issue'
      case 'content':
        return 'content issue'
    }
  }
  switch (id) {
    case 'technical':
      return 'technical issues'
    case 'crawlability':
      return 'crawlability issues'
    case 'content':
      return 'content issues'
  }
}

function onViewIssue(issue: SeoIssue) {
  openModel.value = false
  emit('view-issue', issue)
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="modalTitle"
    :ui="{
      content: showSiteFiles ? 'sm:max-w-xl' : 'sm:max-w-lg',
      description: 'text-muted'
    }"
  >
    <template v-if="row && guide" #body>
      <div class="space-y-6">
        <section>
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            About this category
          </h4>
          <p class="text-sm text-default">
            {{ guide.summary }}
          </p>
        </section>

        <section>
          <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Quick stats
          </h4>
          <dl class="grid grid-cols-3 gap-3">
            <div class="rounded-lg border border-default bg-elevated/40 p-3 text-center">
              <dt class="mb-1 text-xs text-muted">Open issues</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">
                {{ row.count.toLocaleString() }}
              </dd>
              <p class="mt-0.5 text-[11px] text-muted">
                {{ countLabel(row.id, row.count) }}
              </p>
            </div>
            <div
              v-for="stat in secondaryStats"
              :key="stat.label"
              class="rounded-lg border border-default bg-elevated/40 p-3 text-center"
            >
              <dt class="mb-1 text-xs text-muted">{{ stat.label }}</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">
                {{ stat.value }}
              </dd>
            </div>
          </dl>
        </section>

        <SeoSiteFilesPanel
          v-if="showSiteFiles"
          embedded
          :audit="crawlAudit"
          :issues="previewIssues"
          @view-issue="onViewIssue"
        />

        <section>
          <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            What to do next
          </h4>
          <ol class="list-decimal space-y-2 ps-5 text-sm text-default">
            <li v-for="(step, index) in guide.steps" :key="index">
              {{ step }}
            </li>
          </ol>
        </section>

        <section v-if="focusItems.length && row.id !== 'crawlability'">
          <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Top issues to fix
          </h4>
          <ul class="space-y-2">
            <li
              v-for="item in focusItems"
              :key="item.id"
              class="rounded-lg border border-default bg-elevated/40 px-3 py-2.5"
            >
              <p class="text-sm font-medium text-default">{{ item.label }}</p>
              <p class="truncate text-xs capitalize text-muted">{{ item.hint }}</p>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <template v-if="row && guide" #footer>
      <div class="flex w-full justify-end">
        <UButton
          :to="row.to"
          trailing-icon="i-lucide-arrow-right"
          @click="openModel = false"
        >
          {{ guide.ctaLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
