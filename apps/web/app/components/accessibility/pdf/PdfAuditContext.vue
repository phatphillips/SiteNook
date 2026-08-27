<script setup lang="ts">
import type { PdfIssue } from '~/types/sitenook'
import { formatPdfIssueEvidence, getPdfIssueGuidance } from '~/utils/pdfIssueGuidance'

const props = defineProps<{
  issues: PdfIssue[]
  selectedIssueId?: string | null
}>()

const emit = defineEmits<{
  select: [issue: PdfIssue]
  'go-to-page': [page: number]
}>()

const toast = useToast()

const documentIssues = computed(() =>
  props.issues.filter(issue => issue.category === 'document')
)

const elementIssues = computed(() =>
  props.issues.filter(issue => issue.category === 'element')
)

const selectedIssue = computed(() =>
  props.issues.find(issue => issue.id === props.selectedIssueId) ?? null
)

const guidance = computed(() =>
  selectedIssue.value ? getPdfIssueGuidance(selectedIssue.value) : null
)

const evidenceText = computed(() =>
  selectedIssue.value ? formatPdfIssueEvidence(selectedIssue.value.evidence) : null
)

const severityColor = computed(() => {
  switch (selectedIssue.value?.severity) {
    case 'critical': return 'error'
    case 'serious': return 'error'
    case 'moderate': return 'warning'
    default: return 'neutral'
  }
})

function onSelect(issue: PdfIssue) {
  emit('select', issue)
}

async function copyIssueDetails() {
  if (!selectedIssue.value) return
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
    <div class="shrink-0 border-b border-default px-3 py-2.5">
      <h2
        class="text-sm font-semibold text-highlighted"
        :aria-label="issues.length
          ? `Issues, ${issues.length} ${issues.length === 1 ? 'finding' : 'findings'}`
          : 'Issues'"
      >
        Issues
        <span
          v-if="issues.length"
          class="ml-1.5 font-normal text-muted"
        >· {{ issues.length }}</span>
      </h2>
      <p class="text-xs text-muted">
        Findings for this PDF
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="!issues.length"
        class="px-4 py-8 text-sm text-muted"
      >
        No accessibility issues found.
      </div>

      <div
        v-else
        class="space-y-3 border-b border-default p-3"
      >
        <section v-if="documentIssues.length">
          <h3 class="mb-1.5 text-xs font-medium text-muted">
            Document · {{ documentIssues.length }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="issue in documentIssues"
              :key="issue.id"
            >
              <button
                type="button"
                class="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-xs transition-all duration-150
                  hover:border-default hover:bg-muted/50 active:scale-[0.99]
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                :class="selectedIssueId === issue.id
                  ? 'border-primary/40 bg-primary/10 text-highlighted'
                  : 'border-transparent text-muted'"
                @click="onSelect(issue)"
              >
                <UIcon
                  name="i-lucide-circle-alert"
                  class="mt-0.5 size-3.5 shrink-0 text-error"
                />
                <span class="flex-1 leading-snug">{{ issue.title }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section v-if="elementIssues.length">
          <h3 class="mb-1.5 text-xs font-medium text-muted">
            Element · {{ elementIssues.length }}
          </h3>
          <ul class="space-y-1">
            <li
              v-for="issue in elementIssues"
              :key="issue.id"
            >
              <button
                type="button"
                class="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-xs transition-all duration-150
                  hover:border-default hover:bg-muted/50 active:scale-[0.99]
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                :class="selectedIssueId === issue.id
                  ? 'border-primary/40 bg-primary/10 text-highlighted'
                  : 'border-transparent text-muted'"
                @click="onSelect(issue)"
              >
                <UIcon
                  name="i-lucide-circle-alert"
                  class="mt-0.5 size-3.5 shrink-0 text-error"
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
        v-if="selectedIssue"
        class="space-y-4 p-3 transition-opacity duration-200"
      >
        <div class="flex flex-wrap items-center gap-2">
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
          class="text-xs text-muted"
        >
          {{ guidance.summary }}
        </p>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="selectedIssue.page_number"
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-file-search"
            :label="`Go to page ${selectedIssue.page_number}`"
            @click="goToPage"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            label="Copy details"
            @click="copyIssueDetails"
          />
          <UButton
            v-if="guidance?.learnMoreUrl"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-external-link"
            label="Learn more"
            :href="guidance.learnMoreUrl"
            target="_blank"
          />
        </div>

        <section>
          <h4 class="mb-2 text-xs font-medium text-muted">
            How to fix
          </h4>
          <ol class="list-decimal space-y-1.5 pl-4 text-xs text-highlighted">
            <li
              v-for="(step, index) in guidance?.fixSteps ?? []"
              :key="index"
            >
              {{ step }}
            </li>
          </ol>
        </section>

        <section v-if="selectedIssue.description && selectedIssue.description !== selectedIssue.title">
          <h4 class="mb-2 text-xs font-medium text-muted">
            Validation rule
          </h4>
          <p class="text-xs text-muted">
            {{ selectedIssue.description }}
          </p>
        </section>

        <section v-if="evidenceText">
          <h4 class="mb-2 text-xs font-medium text-muted">
            Location in document
          </h4>
          <code class="block overflow-x-auto rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted">
            {{ evidenceText }}
          </code>
        </section>
      </div>

      <div
        v-else-if="issues.length"
        class="flex flex-col items-center justify-center px-4 py-10 text-center"
      >
        <UIcon
          name="i-lucide-mouse-pointer-click"
          class="mb-2 size-7 text-muted"
        />
        <p class="text-xs text-muted">
          Select an issue to see what it means and how to fix it.
        </p>
      </div>
    </div>
  </div>
</template>
