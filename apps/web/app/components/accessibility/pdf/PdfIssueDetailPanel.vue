<script setup lang="ts">
import type { PdfIssue } from '~/types/sitenook'
import { formatPdfIssueEvidence, getPdfIssueGuidance } from '~/utils/pdfIssueGuidance'

const props = defineProps<{
  issue: PdfIssue | null
}>()

const emit = defineEmits<{
  'go-to-page': [page: number]
}>()

const toast = useToast()

const guidance = computed(() =>
  props.issue ? getPdfIssueGuidance(props.issue) : null
)

const evidenceText = computed(() =>
  props.issue ? formatPdfIssueEvidence(props.issue.evidence) : null
)

const severityColor = computed(() => {
  switch (props.issue?.severity) {
    case 'critical': return 'error'
    case 'serious': return 'error'
    case 'moderate': return 'warning'
    default: return 'neutral'
  }
})

async function copyIssueDetails() {
  if (!props.issue) return
  const parts = [
    props.issue.title,
    props.issue.description,
    evidenceText.value
  ].filter(Boolean)
  await navigator.clipboard.writeText(parts.join('\n\n'))
  toast.add({ title: 'Copied issue details', color: 'success' })
}

function goToPage() {
  if (props.issue?.page_number) {
    emit('go-to-page', props.issue.page_number)
  }
}
</script>

<template>
  <div class="flex h-full flex-col border-r border-default bg-default">
    <div class="border-b border-default px-4 py-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Issue details
      </h2>
    </div>

    <div
      v-if="!issue"
      class="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"
    >
      <UIcon
        name="i-lucide-mouse-pointer-click"
        class="mb-3 size-8 text-muted"
      />
      <p class="text-sm text-muted">
        Select an issue to see what it means and how to fix it.
      </p>
    </div>

    <div
      v-else
      class="flex flex-1 flex-col overflow-y-auto"
    >
      <div class="space-y-4 border-b border-default p-4">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :color="severityColor"
            variant="subtle"
            size="sm"
            class="capitalize"
          >
            {{ issue.severity }}
          </UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            class="capitalize"
          >
            {{ issue.category }}
          </UBadge>
          <UBadge
            v-if="(issue.occurrence_count ?? 1) > 1"
            color="neutral"
            variant="outline"
            size="sm"
          >
            {{ issue.occurrence_count }} occurrences
          </UBadge>
        </div>

        <h4 class="text-base font-semibold text-highlighted">
          {{ issue.title }}
        </h4>

        <p
          v-if="guidance?.summary"
          class="text-sm text-muted"
        >
          {{ guidance.summary }}
        </p>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="issue.page_number"
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-file-search"
            :label="`Go to page ${issue.page_number}`"
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
      </div>

      <div class="space-y-4 p-4">
        <section>
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            How to fix
          </h4>
          <ol class="list-decimal space-y-2 pl-4 text-sm text-highlighted">
            <li
              v-for="(step, index) in guidance?.fixSteps ?? []"
              :key="index"
            >
              {{ step }}
            </li>
          </ol>
        </section>

        <section v-if="issue.description && issue.description !== issue.title">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Validation rule
          </h4>
          <p class="text-sm text-muted">
            {{ issue.description }}
          </p>
        </section>

        <section v-if="evidenceText">
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Location in document
          </h4>
          <code class="block overflow-x-auto rounded-md bg-muted/40 px-3 py-2 text-xs text-muted">
            {{ evidenceText }}
          </code>
        </section>
      </div>
    </div>
  </div>
</template>
