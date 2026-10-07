<script setup lang="ts">
import type { PdfDocument, PdfIssue, PdfRemediation } from '~/types/sitenook'
import { remediationLiftLabel } from '~/utils/pdfRemediationExport'
import PdfPreviewViewer from '~/components/accessibility/pdf/PdfPreviewViewer.vue'

const props = defineProps<{
  document: PdfDocument
  remediation: PdfRemediation | null
  originalUrl: string | null
  suggestedUrl: string | null
  /** Original audit issues (before assisted fix). */
  issues?: PdfIssue[]
}>()

defineEmits<{
  downloadSuggested: []
  exportPack: []
}>()

const showFixedPreview = ref(false)

const issueSummary = computed(() => {
  const rows = props.issues ?? []
  const byTitle = new Map<string, { title: string, count: number, pages: Set<number> }>()
  for (const issue of rows) {
    const key = issue.title || issue.rule_id
    const existing = byTitle.get(key)
    if (existing) {
      existing.count += issue.occurrence_count ?? 1
      if (issue.page_number) existing.pages.add(issue.page_number)
    } else {
      byTitle.set(key, {
        title: issue.title || issue.rule_id,
        count: issue.occurrence_count ?? 1,
        pages: new Set(issue.page_number ? [issue.page_number] : [])
      })
    }
  }
  return [...byTitle.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map(row => ({
      title: row.title,
      count: row.count,
      pages: [...row.pages].sort((a, b) => a - b)
    }))
})

const remainingIssues = computed(() => props.remediation?.after_issue_count ?? null)
const isComplete = computed(() => props.remediation?.status === 'complete')
const isBusy = computed(() =>
  props.remediation?.status === 'processing'
  || props.remediation?.status === 'pending'
  || props.document.remediation_status === 'processing'
  || props.document.remediation_status === 'pending'
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="rounded-xl border border-default p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-semibold text-highlighted">
            Before & after assisted fix
          </h3>
          <p class="mt-1 text-sm text-muted">
            See how score and issues changed after SiteNook applied an assisted structural fix, then re-checked with veraPDF. This is remediation help. Not certified PDF/UA.
          </p>
          <p
            v-if="isComplete"
            class="mt-2 text-sm font-medium text-highlighted"
          >
            {{ remediationLiftLabel(remediation) }}
          </p>
          <p
            v-else-if="isBusy"
            class="mt-2 text-sm text-muted"
          >
            Generating assisted fix…
          </p>
          <p
            v-else-if="remediation?.error_message || document.remediation_status === 'failed'"
            class="mt-2 text-sm text-error"
          >
            {{ remediation?.error_message || 'Assisted fix failed.' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-download"
            :disabled="!suggestedUrl"
            @click="$emit('downloadSuggested')"
          >
            Download fixed PDF
          </UButton>
          <UButton
            size="sm"
            color="primary"
            icon="i-lucide-package"
            :disabled="!remediation || remediation.status !== 'complete'"
            @click="$emit('exportPack')"
          >
            Export remediation pack
          </UButton>
        </div>
      </div>

      <div
        v-if="isComplete"
        class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <div class="rounded-lg bg-elevated p-3">
          <p class="text-xs text-muted">
            Before score
          </p>
          <p class="text-lg font-semibold">
            {{ remediation?.before_score ?? '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-elevated p-3">
          <p class="text-xs text-muted">
            After score
          </p>
          <p class="text-lg font-semibold text-success">
            {{ remediation?.after_score ?? '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-elevated p-3">
          <p class="text-xs text-muted">
            Before issues
          </p>
          <p class="text-lg font-semibold">
            {{ remediation?.before_issue_count ?? '—' }}
          </p>
        </div>
        <div class="rounded-lg bg-elevated p-3">
          <p class="text-xs text-muted">
            After issues
          </p>
          <p class="text-lg font-semibold">
            {{ remediation?.after_issue_count ?? '—' }}
          </p>
        </div>
      </div>
    </div>

    <div class="grid h-[min(70vh,800px)] min-h-[480px] grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-3 py-2">
          <span class="text-xs font-semibold tracking-wide text-muted uppercase">
            Original PDF
          </span>
        </div>
        <PdfPreviewViewer
          class="min-h-0 flex-1"
          :file-url="originalUrl"
        />
      </section>

      <section
        class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-default"
        aria-label="Assisted fix summary"
      >
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-default px-3 py-2">
          <span class="text-xs font-semibold tracking-wide text-muted uppercase">
            What improved
          </span>
          <UButton
            v-if="suggestedUrl"
            size="xs"
            color="neutral"
            variant="ghost"
            :icon="showFixedPreview ? 'i-lucide-list' : 'i-lucide-file-text'"
            :label="showFixedPreview ? 'Show summary' : 'Preview fixed PDF'"
            @click="showFixedPreview = !showFixedPreview"
          />
        </div>

        <div
          v-if="showFixedPreview && suggestedUrl"
          class="min-h-0 flex-1"
        >
          <PdfPreviewViewer
            class="h-full min-h-0"
            :file-url="suggestedUrl"
          />
        </div>

        <div
          v-else
          class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        >
          <div
            v-if="!remediation && !isBusy"
            class="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted"
          >
            <UIcon
              name="i-lucide-wand-sparkles"
              class="size-8 text-muted"
            />
            <p>Run <strong class="text-highlighted">Generate assisted fix</strong> to see before/after results here.</p>
          </div>

          <div
            v-else-if="isBusy"
            class="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-7 animate-spin"
            />
            <p>Applying assisted fix and re-checking with veraPDF…</p>
          </div>

          <template v-else-if="isComplete">
            <div class="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-highlighted">
              <p class="font-medium">
                {{ remediationLiftLabel(remediation) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Assisted tagging improved structure for assistive technology. Always re-validate and finish remaining issues in Acrobat/PAC if needed.
              </p>
            </div>

            <section v-if="issueSummary.length">
              <h4 class="mb-2 text-[10px] font-semibold tracking-wide text-muted uppercase">
                Issues in the original
              </h4>
              <ul class="space-y-2">
                <li
                  v-for="row in issueSummary"
                  :key="row.title"
                  class="rounded-lg border border-default bg-elevated/50 px-3 py-2"
                >
                  <div class="flex items-start gap-2">
                    <UIcon
                      name="i-lucide-circle-check"
                      class="mt-0.5 size-4 shrink-0 text-success"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-xs font-medium text-highlighted">
                        {{ row.title }}
                      </p>
                      <p class="mt-0.5 text-[11px] text-muted">
                        {{ row.count }} finding{{ row.count === 1 ? '' : 's' }}
                        <span v-if="row.pages.length">
                          · p.{{ row.pages.join(', ') }}
                        </span>
                      </p>
                    </div>
                  </div>
                </li>
              </ul>
            </section>

            <section
              v-if="remainingIssues != null"
              class="rounded-lg border border-default px-3 py-2"
            >
              <h4 class="text-[10px] font-semibold tracking-wide text-muted uppercase">
                Remaining work
              </h4>
              <p
                v-if="remainingIssues === 0"
                class="mt-1 text-xs text-highlighted"
              >
                Re-check reported 0 issues. Still download and spot-check. Assisted fix is not a PDF/UA certificate.
              </p>
              <p
                v-else
                class="mt-1 text-xs text-muted"
              >
                {{ remainingIssues }} issue{{ remainingIssues === 1 ? '' : 's' }} may remain after the assisted fix. Finish those in Acrobat/PAC, then re-validate.
              </p>
            </section>

            <section class="text-xs text-muted">
              <h4 class="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">
                Next steps
              </h4>
              <ol class="list-decimal space-y-1 pl-4">
                <li>Download the fixed PDF or export the remediation pack.</li>
                <li>Open in your preferred checker / Acrobat for a final pass.</li>
                <li>Replace the published PDF once you’re satisfied.</li>
              </ol>
            </section>
          </template>

          <div
            v-else
            class="text-sm text-error"
          >
            {{ remediation?.error_message || 'Assisted fix failed. Try Generate assisted fix again.' }}
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
