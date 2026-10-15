<script setup lang="ts">
import type { BrokenLink, PolicyMatch, SpellingIssue } from '~/types/sitenook'
import type { QaIssueBreakdownRow, QaIssueCategoryId } from '~/utils/qaIssueBreakdown'
import { qaCategoryGuide } from '~/utils/qaCategoryDetails'

const props = defineProps<{
  open: boolean
  row: QaIssueBreakdownRow | null
  previewBrokenLinks: BrokenLink[]
  previewSpelling: SpellingIssue[]
  previewPolicyMatches: PolicyMatch[]
  internalBrokenLinkCount: number
  externalBrokenLinkCount: number
  wordsToReviewCount: number
  avgReadability: number
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const guide = computed(() =>
  props.row ? qaCategoryGuide(props.row.id) : null
)

const modalTitle = computed(() =>
  props.row ? props.row.label : 'Issue category'
)

const countLabel = computed(() => {
  if (!props.row) return 'items'
  switch (props.row.id) {
    case 'broken_links':
      return props.row.count === 1 ? 'broken link' : 'broken links'
    case 'misspellings':
      return props.row.count === 1 ? 'misspelling' : 'misspellings'
    case 'words_to_review':
      return props.row.count === 1 ? 'word to review' : 'words to review'
    case 'policies':
      return props.row.count === 1 ? 'policy match' : 'policy matches'
    case 'inventory':
      return props.row.count === 1 ? 'inventory asset' : 'inventory assets'
  }
})

const secondaryStats = computed(() => {
  if (!props.row) return [] as Array<{ label: string, value: string }>
  const id = props.row.id as QaIssueCategoryId
  if (id === 'broken_links') {
    return [
      { label: 'Internal', value: String(props.internalBrokenLinkCount) },
      { label: 'External', value: String(props.externalBrokenLinkCount) }
    ]
  }
  if (id === 'misspellings' || id === 'words_to_review') {
    return [
      { label: 'Words to review', value: String(props.wordsToReviewCount) },
      ...(props.avgReadability
        ? [{ label: 'Avg readability', value: String(props.avgReadability) }]
        : [])
    ]
  }
  return []
})

const focusItems = computed(() => {
  if (!props.row) return [] as Array<{ label: string, hint: string }>
  switch (props.row.id) {
    case 'broken_links':
      return props.previewBrokenLinks.slice(0, 3).map(link => ({
        label: 'Broken link',
        hint: link.href.length > 64 ? `${link.href.slice(0, 61)}…` : link.href
      }))
    case 'misspellings':
    case 'words_to_review':
      return props.previewSpelling.slice(0, 3).map(item => ({
        label: 'Flagged word',
        hint: `"${item.word}"`
      }))
    case 'policies':
      return props.previewPolicyMatches.slice(0, 3).map(match => ({
        label: 'Policy match',
        hint: match.expand?.policy?.name || 'Policy rule'
      }))
    default:
      return []
  }
})
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="modalTitle"
    :ui="{ content: 'sm:max-w-lg', description: 'text-muted' }"
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
          <dl
            class="grid gap-3"
            :class="secondaryStats.length ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'"
          >
            <div class="rounded-lg border border-default bg-elevated/40 p-3 text-center">
              <dt class="mb-1 text-xs text-muted">Count</dt>
              <dd class="text-lg font-semibold tabular-nums text-default">
                {{ row.count.toLocaleString() }}
              </dd>
              <p class="mt-0.5 text-[11px] text-muted">{{ countLabel }}</p>
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

        <section v-if="focusItems.length">
          <h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Examples from latest scan
          </h4>
          <ul class="space-y-2">
            <li
              v-for="(item, index) in focusItems"
              :key="`${item.label}-${index}`"
              class="rounded-lg border border-default bg-elevated/40 px-3 py-2.5"
            >
              <p class="text-sm font-medium text-default">{{ item.label }}</p>
              <p class="truncate text-xs text-muted">{{ item.hint }}</p>
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
