<script setup lang="ts">
import type { PdfIssue } from '~/types/sitenook'
import { formatPdfIssueEvidence, getPdfIssueGuidance } from '~/utils/pdfIssueGuidance'

type IssueScope = 'page' | 'all'

const props = defineProps<{
  issues: PdfIssue[]
  selectedIssueId?: string | null
  /** Preview page used for “This page” filtering. */
  currentPage?: number
}>()

const emit = defineEmits<{
  select: [issue: PdfIssue]
  'go-to-page': [page: number]
}>()

const toast = useToast()
const detailsOpen = ref(false)
const scope = ref<IssueScope>('page')

const pageNumber = computed(() =>
  props.currentPage && props.currentPage > 0 ? props.currentPage : 1
)

function matchesPageScope(issue: PdfIssue): boolean {
  // Document-wide findings stay visible on every page.
  if (issue.category === 'document') return true
  if (!issue.page_number) return true
  return issue.page_number === pageNumber.value
}

const scopedIssues = computed(() => {
  if (scope.value === 'all') return props.issues
  return props.issues.filter(matchesPageScope)
})

const documentIssues = computed(() =>
  scopedIssues.value.filter(issue => issue.category === 'document')
)

const elementIssues = computed(() =>
  scopedIssues.value.filter(issue => issue.category === 'element')
)

const selectedIssue = computed(() =>
  props.issues.find(issue => issue.id === props.selectedIssueId) ?? null
)

const selectedInScope = computed(() =>
  scopedIssues.value.some(issue => issue.id === props.selectedIssueId)
)

const guidance = computed(() =>
  selectedIssue.value && selectedInScope.value
    ? getPdfIssueGuidance(selectedIssue.value)
    : null
)

const evidenceText = computed(() =>
  selectedIssue.value && selectedInScope.value
    ? formatPdfIssueEvidence(selectedIssue.value.evidence)
    : null
)

const severityColor = computed(() => {
  switch (selectedIssue.value?.severity) {
    case 'critical': return 'error'
    case 'serious': return 'error'
    case 'moderate': return 'warning'
    default: return 'neutral'
  }
})

const hasExpandableDetails = computed(() => {
  if (!selectedIssue.value || !selectedInScope.value) return false
  const hasSteps = (guidance.value?.fixSteps?.length ?? 0) > 0
  const hasRule = Boolean(
    selectedIssue.value.description
    && selectedIssue.value.description !== selectedIssue.value.title
  )
  return hasSteps || hasRule || Boolean(evidenceText.value)
})

const pageIssueCount = computed(() =>
  props.issues.filter(matchesPageScope).length
)

watch(() => props.selectedIssueId, () => {
  detailsOpen.value = false
})

watch(
  [scopedIssues, () => props.selectedIssueId],
  ([visible]) => {
    if (!visible.length) return
    if (props.selectedIssueId && visible.some(issue => issue.id === props.selectedIssueId)) return
    const next = visible[0]
    if (next) emit('select', next)
  },
  { immediate: true }
)

function onSelect(issue: PdfIssue) {
  emit('select', issue)
}

function setScope(next: IssueScope) {
  scope.value = next
}

async function copyIssueDetails() {
  if (!selectedIssue.value || !selectedInScope.value) return
  const parts = [
    selectedIssue.value.title,
    selectedIssue.value.description,
    evidenceText.value
  ].filter(Boolean)
  await navigator.clipboard.writeText(parts.join('\n\n'))
  toast.add({ title: 'Copied issue details', color: 'success' })
}

function goToPage() {
  if (selectedIssue.value?.page_number) {
    emit('go-to-page', selectedIssue.value.page_number)
  }
}
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col bg-default"
    aria-label="Issues"
  >
    <div class="shrink-0 space-y-2 border-b border-default px-3 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <h2
          class="text-sm font-semibold text-highlighted"
          :aria-label="scopedIssues.length
            ? `Issues, ${scopedIssues.length} ${scopedIssues.length === 1 ? 'finding' : 'findings'}`
            : 'Issues'"
        >
          Issues
          <span
            v-if="scopedIssues.length"
            class="ml-1.5 font-normal text-muted"
          >· {{ scopedIssues.length }}</span>
        </h2>
      </div>

      <div
        class="inline-flex rounded-md border border-default p-0.5"
        role="group"
        aria-label="Issue scope"
      >
        <button
          type="button"
          class="rounded px-2.5 py-1 text-sm font-medium transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :class="scope === 'page'
            ? 'bg-primary/15 text-primary'
            : 'text-muted hover:bg-muted/50 hover:text-highlighted'"
          :aria-pressed="scope === 'page'"
          @click="setScope('page')"
        >
          This page
          <span class="ml-1 opacity-70">{{ pageIssueCount }}</span>
        </button>
        <button
          type="button"
          class="rounded px-2.5 py-1 text-sm font-medium transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :class="scope === 'all'
            ? 'bg-primary/15 text-primary'
            : 'text-muted hover:bg-muted/50 hover:text-highlighted'"
          :aria-pressed="scope === 'all'"
          @click="setScope('all')"
        >
          All pages
          <span class="ml-1 opacity-70">{{ issues.length }}</span>
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="!issues.length"
        class="px-4 py-8 text-sm text-muted"
      >
        No accessibility issues found.
      </div>

      <div
        v-else-if="!scopedIssues.length"
        class="flex flex-col items-center gap-3 px-4 py-8 text-center"
      >
        <p class="text-sm text-muted">
          No issues on page {{ pageNumber }}.
        </p>
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          label="Show all pages"
          @click="setScope('all')"
        />
      </div>

      <template v-else>
        <div class="space-y-2.5 border-b border-default p-2.5">
          <section v-if="documentIssues.length">
            <h3 class="mb-1 px-0.5 text-xs font-medium text-muted">
              Document · {{ documentIssues.length }}
            </h3>
            <ul class="space-y-0.5">
              <li
                v-for="issue in documentIssues"
                :key="issue.id"
              >
                <button
                  type="button"
                  class="flex min-h-9 w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors duration-150
                    hover:border-default hover:bg-muted/50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :class="selectedIssueId === issue.id
                    ? 'border-primary/40 bg-primary/10 text-highlighted'
                    : 'border-transparent text-muted'"
                  @click="onSelect(issue)"
                >
                  <UIcon
                    name="i-lucide-circle-alert"
                    class="mt-0.5 size-3.5 shrink-0 text-error"
                    aria-hidden="true"
                  />
                  <span class="flex-1 leading-snug">{{ issue.title }}</span>
                </button>
              </li>
            </ul>
          </section>

          <section v-if="elementIssues.length">
            <h3 class="mb-1 px-0.5 text-xs font-medium text-muted">
              Element · {{ elementIssues.length }}
            </h3>
            <ul class="space-y-0.5">
              <li
                v-for="issue in elementIssues"
                :key="issue.id"
              >
                <button
                  type="button"
                  class="flex min-h-9 w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors duration-150
                    hover:border-default hover:bg-muted/50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :class="selectedIssueId === issue.id
                    ? 'border-primary/40 bg-primary/10 text-highlighted'
                    : 'border-transparent text-muted'"
                  @click="onSelect(issue)"
                >
                  <UIcon
                    name="i-lucide-circle-alert"
                    class="mt-0.5 size-3.5 shrink-0 text-error"
                    aria-hidden="true"
                  />
                  <span class="flex-1 leading-snug">{{ issue.title }}</span>
                  <UBadge
                    v-if="(issue.occurrence_count ?? 1) > 1"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  >
                    {{ issue.occurrence_count }}
                  </UBadge>
                </button>
              </li>
            </ul>
          </section>
        </div>

        <div
          v-if="selectedIssue && selectedInScope"
          class="space-y-3 p-2.5"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <UBadge
              :color="severityColor"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ selectedIssue.severity }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
              class="capitalize"
            >
              {{ selectedIssue.category }}
            </UBadge>
          </div>

          <h3 class="text-sm font-semibold text-highlighted">
            {{ selectedIssue.title }}
          </h3>

          <p
            v-if="guidance?.summary"
            class="line-clamp-3 text-sm text-muted"
          >
            {{ guidance.summary }}
          </p>

          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-if="selectedIssue.page_number"
              size="sm"
              color="primary"
              variant="soft"
              icon="i-lucide-file-search"
              :label="`Go to page ${selectedIssue.page_number}`"
              @click="goToPage"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              label="Copy details"
              @click="copyIssueDetails"
            />
            <UButton
              v-if="guidance?.learnMoreUrl"
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-external-link"
              label="Learn more"
              :href="guidance.learnMoreUrl"
              target="_blank"
            />
          </div>

          <div v-if="hasExpandableDetails">
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm font-medium text-muted
                transition-colors hover:bg-muted/40 hover:text-highlighted
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :aria-expanded="detailsOpen"
              aria-controls="pdf-issue-details"
              @click="detailsOpen = !detailsOpen"
            >
              <span>{{ detailsOpen ? 'Hide how to fix' : 'How to fix & details' }}</span>
              <UIcon
                :name="detailsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4"
                aria-hidden="true"
              />
            </button>

            <div
              v-if="detailsOpen"
              id="pdf-issue-details"
              class="mt-2 space-y-3 border-t border-default pt-3"
            >
              <section v-if="(guidance?.fixSteps?.length ?? 0) > 0">
                <h4 class="mb-1.5 text-xs font-medium text-muted">
                  How to fix
                </h4>
                <ol class="list-decimal space-y-1.5 pl-4 text-sm text-highlighted">
                  <li
                    v-for="(step, index) in guidance?.fixSteps ?? []"
                    :key="index"
                  >
                    {{ step }}
                  </li>
                </ol>
              </section>

              <section v-if="selectedIssue.description && selectedIssue.description !== selectedIssue.title">
                <h4 class="mb-1.5 text-xs font-medium text-muted">
                  Validation rule
                </h4>
                <p class="text-sm text-muted">
                  {{ selectedIssue.description }}
                </p>
              </section>

              <section v-if="evidenceText">
                <h4 class="mb-1.5 text-xs font-medium text-muted">
                  Location in document
                </h4>
                <code class="block overflow-x-auto rounded-md bg-muted/40 px-2.5 py-2 text-sm text-muted">
                  {{ evidenceText }}
                </code>
              </section>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
