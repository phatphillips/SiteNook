<script setup lang="ts">
import type { A11yIssueActionEntry } from '~/utils/a11yIssueHistory'
import {
  formatA11yIssueActionDetail,
  formatA11yIssueActionSentence,
  formatA11yIssueActionTimestamp,
  getA11yIssueActionMeta
} from '~/utils/a11yIssueHistory'
import type { A11yHistoryFilter } from '~/composables/useA11yIssueHistory'
import { watchDebounced } from '@vueuse/core'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  siteId?: string
  /** When true, show site name on each entry (org issues page). */
  showSiteName?: boolean
  onReopen?: (entry: A11yIssueActionEntry) => void | Promise<void>
}>()

const emit = defineEmits<{
  'view-rule': [ruleId: string]
}>()

const {
  entries,
  loading,
  error,
  page,
  totalPages,
  totalItems,
  filter,
  search,
  fetchHistory,
  siteNameFor
} = useA11yIssueHistory(computed(() => props.siteId))

const reopeningId = ref<string | null>(null)
const expandedIds = ref<Set<string>>(new Set())

const filterOptions: Array<{ label: string, value: A11yHistoryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'Fixed', value: 'fixed' },
  { label: 'Reopened', value: 'reopened' }
]

watch(open, async (isOpen) => {
  if (!isOpen) return
  page.value = 1
  expandedIds.value = new Set()
  await fetchHistory()
})

const { historyRevision } = useA11yScoreRefresh()

watch(historyRevision, async () => {
  if (!open.value) return
  await fetchHistory({ silent: true })
})

watch(filter, async () => {
  if (!open.value) return
  page.value = 1
  await fetchHistory()
})

watchDebounced(search, async () => {
  if (!open.value) return
  page.value = 1
  await fetchHistory()
}, { debounce: 300 })

watch(page, async () => {
  if (!open.value) return
  await fetchHistory()
})

async function onReopen(entry: A11yIssueActionEntry) {
  if (!entry.issue_ids?.length || entry.action === 'reopened') return
  reopeningId.value = entry.id
  try {
    await props.onReopen?.(entry)
    await fetchHistory({ silent: true })
  } finally {
    reopeningId.value = null
  }
}

function canReopen(entry: A11yIssueActionEntry): boolean {
  return entry.action !== 'reopened' && (entry.issue_ids?.length ?? 0) > 0
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function entryTitle(entry: A11yIssueActionEntry): string {
  return entry.description || entry.rule_id
}
</script>

<template>
  <UModal
    v-model:open="open"
    class="a11y-issue-history-drawer"
    :close="false"
    :ui="{
      content: 'a11y-issue-history-drawer fixed inset-y-0 right-0 left-auto h-screen w-full max-w-md translate-x-0 translate-y-0 rounded-none sm:max-w-lg m-0',
      overlay: 'bg-black/25',
      header: 'shrink-0 border-b border-default/60 px-4 py-3 sm:px-6',
      body: 'flex-1 min-h-0 overflow-y-auto px-4 sm:px-6',
      footer: 'shrink-0 border-t border-default/60 px-4 py-3 sm:px-6'
    }"
  >
    <template #header="{ close }">
      <div class="flex w-full items-start gap-3">
        <button
          type="button"
          class="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-elevated hover:text-highlighted"
          aria-label="Close history"
          @click="close"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" />
        </button>
        <div class="min-w-0 flex-1">
          <h2 class="text-base font-semibold leading-tight text-highlighted">
            Issue history
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            Dismissals, fixes, and reopen actions on this {{ showSiteName ? 'workspace' : 'site' }}.
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="space-y-3 py-1">
        <div class="flex flex-col gap-2.5">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search rule, page, description…"
            size="sm"
            class="w-full"
          />
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="option in filterOptions"
              :key="option.value"
              size="xs"
              :color="filter === option.value ? 'primary' : 'neutral'"
              :variant="filter === option.value ? 'solid' : 'outline'"
              :label="option.label"
              @click="filter = option.value"
            />
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <div v-if="loading && !entries.length" class="flex justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <div
          v-else-if="!entries.length"
          class="rounded-lg border border-dashed border-default/80 px-4 py-10 text-center"
        >
          <UIcon name="i-lucide-history" class="mx-auto size-8 text-muted" />
          <p class="mt-3 text-sm font-medium text-highlighted">
            No actions yet
          </p>
          <p class="mt-1 text-sm text-muted">
            When you dismiss or mark issues as fixed, they will appear here.
          </p>
        </div>

        <ul v-else class="space-y-1.5">
          <li
            v-for="entry in entries"
            :key="entry.id"
            class="a11y-history-card overflow-hidden rounded-lg border border-default/70 bg-elevated/20 transition hover:border-default"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-elevated/40"
              :aria-expanded="isExpanded(entry.id)"
              :aria-controls="`history-detail-${entry.id}`"
              @click="toggleExpanded(entry.id)"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md bg-default/60"
              >
                <UIcon
                  :name="getA11yIssueActionMeta(entry.action).icon"
                  class="size-3.5"
                  :class="{
                    'text-success': getA11yIssueActionMeta(entry.action).color === 'success',
                    'text-info': getA11yIssueActionMeta(entry.action).color === 'info',
                    'text-muted': getA11yIssueActionMeta(entry.action).color === 'neutral'
                  }"
                />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <UBadge
                    size="sm"
                    variant="subtle"
                    :color="getA11yIssueActionMeta(entry.action).color"
                    class="shrink-0"
                  >
                    {{ getA11yIssueActionMeta(entry.action).label }}
                  </UBadge>
                  <span class="truncate text-xs text-muted">
                    {{ formatA11yIssueActionTimestamp(entry) }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-sm font-medium text-highlighted">
                  {{ entryTitle(entry) }}
                </span>
              </span>

              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 shrink-0 text-muted transition-transform duration-200"
                :class="{ 'rotate-180': isExpanded(entry.id) }"
              />
            </button>

            <div
              :id="`history-detail-${entry.id}`"
              class="a11y-history-detail grid transition-[grid-template-rows] duration-200 ease-out"
              :class="isExpanded(entry.id) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
              <div class="min-h-0 overflow-hidden">
                <div class="space-y-2 border-t border-default/50 px-3 py-2.5">
                  <p class="text-xs text-muted leading-relaxed">
                    {{ formatA11yIssueActionSentence(entry) }}
                  </p>
                  <p
                    v-if="formatA11yIssueActionDetail(entry)"
                    class="text-xs text-muted leading-relaxed break-all"
                  >
                    {{ formatA11yIssueActionDetail(entry) }}
                  </p>
                  <p
                    v-if="showSiteName && siteNameFor(entry)"
                    class="text-xs text-muted"
                  >
                    Site: {{ siteNameFor(entry) }}
                  </p>

                  <div class="flex flex-wrap gap-1 pt-0.5">
                    <UButton
                      v-if="canReopen(entry)"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      icon="i-lucide-rotate-ccw"
                      :loading="reopeningId === entry.id"
                      label="Undo"
                      @click.stop="onReopen(entry)"
                    />
                    <UButton
                      v-if="entry.page_url"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-external-link"
                      label="Open page"
                      :to="entry.page_url"
                      target="_blank"
                      @click.stop
                    />
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-search"
                      label="Find in list"
                      @click.stop="emit('view-rule', entry.rule_id); open = false"
                    />
                  </div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <p class="text-xs text-muted">
          {{ totalItems }} {{ totalItems === 1 ? 'action' : 'actions' }}
        </p>
        <UPagination
          v-if="totalPages > 1"
          v-model:page="page"
          :total="totalItems"
          :items-per-page="20"
          size="xs"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.a11y-history-card {
  animation: a11y-history-in 220ms ease both;
}

@keyframes a11y-history-in {
  from {
    opacity: 0;
    transform: translateX(8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
