<script setup lang="ts">
import type { PdfIssue } from '~/types/sitenook'

const props = defineProps<{
  issues: PdfIssue[]
  selectedIssueId?: string | null
}>()

const emit = defineEmits<{
  select: [issue: PdfIssue]
}>()

const documentIssues = computed(() =>
  props.issues.filter(issue => issue.category === 'document')
)

const elementIssues = computed(() =>
  props.issues.filter(issue => issue.category === 'element')
)

function onSelect(issue: PdfIssue) {
  emit('select', issue)
}
</script>

<template>
  <div class="h-full overflow-y-auto border-r border-default bg-elevated">
    <div class="border-b border-default px-4 py-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Accessibility issues
      </h2>
    </div>

    <div
      v-if="!issues.length"
      class="px-4 py-8 text-sm text-muted"
    >
      No accessibility issues found.
    </div>

    <div
      v-else
      class="space-y-4 p-4"
    >
      <section v-if="documentIssues.length">
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Document issues ({{ documentIssues.length }})
        </h4>
        <ul class="space-y-1">
          <li
            v-for="issue in documentIssues"
            :key="issue.id"
          >
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors"
              :class="selectedIssueId === issue.id
                ? 'border-primary/40 bg-primary/10 text-highlighted'
                : 'border-transparent hover:border-default hover:bg-muted/50'"
              @click="onSelect(issue)"
            >
              <UIcon
                name="i-lucide-circle-alert"
                class="mt-0.5 size-4 shrink-0 text-error"
              />
              <span class="flex-1">{{ issue.title }}</span>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted"
              />
            </button>
          </li>
        </ul>
      </section>

      <section v-if="elementIssues.length">
        <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Element issues ({{ elementIssues.length }})
        </h4>
        <ul class="space-y-1">
          <li
            v-for="issue in elementIssues"
            :key="issue.id"
          >
            <button
              type="button"
              class="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors"
              :class="selectedIssueId === issue.id
                ? 'border-primary/40 bg-primary/10 text-highlighted'
                : 'border-transparent hover:border-default hover:bg-muted/50'"
              @click="onSelect(issue)"
            >
              <UIcon
                name="i-lucide-circle-alert"
                class="mt-0.5 size-4 shrink-0 text-error"
              />
              <span class="flex-1">{{ issue.title }}</span>
              <UBadge
                v-if="(issue.occurrence_count ?? 1) > 1"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ issue.occurrence_count }}
              </UBadge>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted"
              />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
