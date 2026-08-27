<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import type { SeoIssueBreakdownRow } from '~/utils/seoIssueBreakdown'
import { totalOpenSeoIssues } from '~/utils/seoIssueBreakdown'
import { uniqueSeoByRule } from '~/utils/seoIssues'
import { ruleLabel } from '~/utils/seoRules'

const props = defineProps<{
  siteId: string
  rows: SeoIssueBreakdownRow[]
  technicalScore: number | null
  crawlabilityScore: number | null
  contentScore: number | null
  avgReadabilityScore: number | null
  previewIssues: SeoIssue[]
}>()

const openIssueTotal = computed(() =>
  totalOpenSeoIssues({
    technical: props.rows.find(row => row.id === 'technical')?.count ?? 0,
    crawlability: props.rows.find(row => row.id === 'crawlability')?.count ?? 0,
    content: props.rows.find(row => row.id === 'content')?.count ?? 0
  })
)

const topIssues = computed(() => uniqueSeoByRule(props.previewIssues).slice(0, 4))

const focusItems = computed(() =>
  topIssues.value.map((issue) => {
    const category = issue.subcategory === 'crawlability'
      ? 'crawlability'
      : issue.category === 'content' ? 'content' : 'technical'
    const to = category === 'content'
      ? `/sites/${props.siteId}/seo/content`
      : `/sites/${props.siteId}/seo/technical`
    return {
      id: issue.id,
      label: issue.title || ruleLabel(issue.rule_id),
      hint: issue.severity,
      to
    }
  })
)
</script>

<template>
  <div
    class="score-info-panel flex h-full min-h-0 w-full flex-col gap-4 rounded-lg border border-default bg-elevated/25 p-4"
  >
    <div class="flex min-h-[18px] min-w-0 items-center gap-2">
      <p class="min-w-0 text-sm font-bold text-default">
        SEO details
      </p>
    </div>

    <section class="space-y-1">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted">
        Open findings
      </h4>
      <p class="text-sm text-default">
        <template v-if="openIssueTotal">
          Your latest scan has
          <span class="font-semibold tabular-nums">{{ openIssueTotal.toLocaleString() }}</span>
          open SEO issue{{ openIssueTotal === 1 ? '' : 's' }} to review.
        </template>
        <template v-else>
          No open SEO issues on the latest scan.
        </template>
      </p>
    </section>

    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Category scores
      </h4>
      <dl class="grid grid-cols-3 gap-3">
        <div class="rounded-lg bg-elevated/40 p-3 text-center ring-1 ring-default">
          <dt class="mb-1 text-xs text-muted">Technical</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ technicalScore != null ? technicalScore : '—' }}
          </dd>
        </div>
        <div class="rounded-lg bg-elevated/40 p-3 text-center ring-1 ring-default">
          <dt class="mb-1 text-xs text-muted">Crawlability</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ crawlabilityScore != null ? crawlabilityScore : '—' }}
          </dd>
        </div>
        <div class="rounded-lg bg-elevated/40 p-3 text-center ring-1 ring-default">
          <dt class="mb-1 text-xs text-muted">Content</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ contentScore != null ? contentScore : '—' }}
          </dd>
        </div>
      </dl>
    </section>

    <section v-if="avgReadabilityScore != null">
      <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Additional checks
      </h4>
      <ul class="space-y-2 text-sm text-muted">
        <li>
          Average readability score: {{ avgReadabilityScore }} Flesch
        </li>
      </ul>
    </section>

    <section>
      <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Top items to review
      </h4>
      <ul v-if="focusItems.length" class="space-y-2">
        <li
          v-for="item in focusItems"
          :key="item.id"
        >
          <NuxtLink
            :to="item.to"
            class="flex items-start justify-between gap-3 rounded-lg bg-elevated/40 px-3 py-2.5 ring-1 ring-default transition-colors hover:bg-elevated/60 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-default">{{ item.label }}</p>
              <p class="truncate text-xs capitalize text-muted">{{ item.hint }}</p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-muted" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">
        Run a scan with SEO checks enabled to populate focus items.
      </p>
    </section>
  </div>
</template>
