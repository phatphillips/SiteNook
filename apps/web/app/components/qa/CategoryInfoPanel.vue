<script setup lang="ts">
import type { BrokenLink, PolicyMatch, SpellingIssue } from '~/types/sitenook'
import type { QaIssueBreakdownRow } from '~/utils/qaIssueBreakdown'
import { totalOpenQaIssues } from '~/utils/qaIssueBreakdown'

const props = defineProps<{
  siteId: string
  rows: QaIssueBreakdownRow[]
  previewBrokenLinks: BrokenLink[]
  previewSpelling: SpellingIssue[]
  previewPolicyMatches: PolicyMatch[]
  internalBrokenLinkCount: number
  externalBrokenLinkCount: number
  wordsToReviewCount: number
  avgReadability: number
}>()

const openIssueTotal = computed(() =>
  totalOpenQaIssues({
    brokenLinks: props.rows.find(row => row.id === 'broken_links')?.count ?? 0,
    misspellings: props.rows.find(row => row.id === 'misspellings')?.count ?? 0,
    policies: props.rows.find(row => row.id === 'policies')?.count ?? 0
  })
)

const topBrokenLink = computed(() => props.previewBrokenLinks[0]?.href ?? null)
const topMisspelling = computed(() => props.previewSpelling[0]?.word ?? null)
const topPolicy = computed(() => props.previewPolicyMatches[0]?.expand?.policy?.name ?? null)

const focusItems = computed(() => {
  const items: Array<{ label: string, hint: string, to: string }> = []
  if (topBrokenLink.value) {
    items.push({
      label: 'Broken link',
      hint: topBrokenLink.value.length > 56 ? `${topBrokenLink.value.slice(0, 53)}…` : topBrokenLink.value,
      to: `/sites/${props.siteId}/qa/links`
    })
  }
  if (topMisspelling.value) {
    items.push({
      label: 'Misspelling',
      hint: `"${topMisspelling.value}"`,
      to: `/sites/${props.siteId}/qa/spelling`
    })
  }
  if (topPolicy.value) {
    items.push({
      label: 'Policy match',
      hint: topPolicy.value,
      to: `/sites/${props.siteId}/qa/policies`
    })
  }
  return items.slice(0, 4)
})
</script>

<template>
  <div
    class="score-info-panel flex h-full min-h-0 w-full flex-col gap-4 rounded-lg border border-default bg-elevated p-4"
  >
    <div class="flex min-h-[18px] min-w-0 items-center gap-2">
      <p class="min-w-0 text-sm font-bold text-default">
        QA details
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
          open QA issue{{ openIssueTotal === 1 ? '' : 's' }} to review.
        </template>
        <template v-else>
          No open QA issues on the latest scan.
        </template>
      </p>
    </section>

    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Quick stats
      </h4>
      <dl class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <dt class="text-xs text-muted mb-1">Broken links</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ rows.find(row => row.id === 'broken_links')?.count ?? 0 }}
          </dd>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <dt class="text-xs text-muted mb-1">Misspellings</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ rows.find(row => row.id === 'misspellings')?.count ?? 0 }}
          </dd>
        </div>
        <div class="rounded-lg border border-default bg-elevated p-3 text-center">
          <dt class="text-xs text-muted mb-1">Policies</dt>
          <dd class="text-lg font-semibold tabular-nums text-default">
            {{ rows.find(row => row.id === 'policies')?.count ?? 0 }}
          </dd>
        </div>
      </dl>
    </section>

    <section v-if="internalBrokenLinkCount || externalBrokenLinkCount || wordsToReviewCount || avgReadability">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Additional checks
      </h4>
      <ul class="space-y-2 text-sm text-muted">
        <li v-if="internalBrokenLinkCount || externalBrokenLinkCount">
          {{ internalBrokenLinkCount }} internal · {{ externalBrokenLinkCount }} external broken links
        </li>
        <li v-if="wordsToReviewCount">
          {{ wordsToReviewCount }} word{{ wordsToReviewCount === 1 ? '' : 's' }} flagged for review
        </li>
        <li v-if="avgReadability">
          Average readability score: {{ avgReadability }}
        </li>
      </ul>
    </section>

    <section>
      <h4 class="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
        Top items to review
      </h4>
      <ul v-if="focusItems.length" class="space-y-2">
        <li
          v-for="item in focusItems"
          :key="item.label"
        >
          <NuxtLink
            :to="item.to"
            class="flex items-start justify-between gap-3 rounded-lg border border-default bg-elevated px-3 py-2.5 transition-colors hover:bg-muted hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-default">{{ item.label }}</p>
              <p class="text-xs text-muted truncate">{{ item.hint }}</p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted mt-0.5" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">
        Run a scan with QA checks enabled to populate focus items.
      </p>
    </section>
  </div>
</template>
