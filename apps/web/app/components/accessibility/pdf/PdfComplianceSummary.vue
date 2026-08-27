<script setup lang="ts">
import type { PdfDocument } from '~/types/sitenook'
import { scoreRingColor } from '~/utils/siteimproveScore'

const props = defineProps<{
  document: PdfDocument
  issueCount: number
}>()

type Meta = {
  hasTags?: boolean
  taggedForAccessibility?: boolean
  pdfUa?: boolean
}

const meta = computed(() => (props.document.pdf_metadata ?? {}) as Meta)

const summary = computed(() =>
  (props.document.report_summary ?? {}) as { compliant?: boolean }
)

const score = computed(() => {
  const value = props.document.accessibility_score
  if (value == null || props.document.status !== 'complete') return null
  return Math.round(value)
})

const ringColor = computed(() =>
  score.value != null ? scoreRingColor(score.value) : 'var(--ui-text-muted)'
)

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const dashOffset = computed(() => {
  const pct = score.value != null ? Math.max(0, Math.min(100, score.value)) : 0
  return CIRCUMFERENCE * (1 - pct / 100)
})

type CheckState = 'yes' | 'no' | 'unknown'

function checkState(value: boolean | undefined): CheckState {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'unknown'
}

const pdfUa = computed((): CheckState => {
  if (summary.value.compliant === true || meta.value.pdfUa === true) return 'yes'
  if (summary.value.compliant === false || meta.value.pdfUa === false) return 'no'
  return 'unknown'
})

const tagged = computed((): CheckState =>
  checkState(
    props.document.has_pdf_tags === true || meta.value.hasTags === true
      ? true
      : props.document.has_pdf_tags === false || meta.value.hasTags === false
        ? false
        : undefined
  )
)

const machineReadable = computed((): CheckState =>
  checkState(
    props.document.machine_readable === true || meta.value.taggedForAccessibility === true
      ? true
      : props.document.machine_readable === false
        ? false
        : undefined
  )
)

const checks = computed(() => [
  { id: 'pdfua', label: 'PDF/UA', state: pdfUa.value, yesLabel: 'Likely compliant', noLabel: 'Not compliant' },
  { id: 'tagged', label: 'Tagged', state: tagged.value, yesLabel: 'Yes', noLabel: 'No' },
  { id: 'machine', label: 'Machine-readable text', state: machineReadable.value, yesLabel: 'Yes', noLabel: 'No' }
])

function stateIcon(state: CheckState): string {
  if (state === 'yes') return 'i-lucide-circle-check'
  if (state === 'no') return 'i-lucide-circle-x'
  return 'i-lucide-circle-help'
}

function stateColor(state: CheckState): string {
  if (state === 'yes') return 'text-success'
  if (state === 'no') return 'text-error'
  return 'text-muted'
}

function stateLabel(check: { state: CheckState, yesLabel: string, noLabel: string }): string {
  if (check.state === 'yes') return check.yesLabel
  if (check.state === 'no') return check.noLabel
  return 'Unknown'
}
</script>

<template>
  <div
    class="flex h-full flex-col gap-5"
    aria-label="Accessibility compliance"
  >
    <div class="flex flex-wrap items-center gap-6">
      <div
        class="relative flex size-28 shrink-0 items-center justify-center"
        role="img"
        :aria-label="score != null ? `Accessibility score ${score} out of 100` : 'Accessibility score unavailable'"
      >
        <svg
          class="size-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            :r="RADIUS"
            fill="none"
            stroke="currentColor"
            stroke-width="8"
            class="text-muted/25"
          />
          <circle
            cx="50"
            cy="50"
            :r="RADIUS"
            fill="none"
            :stroke="ringColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
            class="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span
            v-if="score != null"
            class="text-3xl font-semibold tabular-nums leading-none"
            :style="{ color: ringColor }"
          >
            {{ score }}
          </span>
          <span
            v-else
            class="text-2xl font-semibold text-muted"
          >—</span>
          <span class="mt-1 text-[11px] text-muted">
            / 100
          </span>
        </div>
      </div>

      <div class="min-w-0 space-y-1">
        <p class="text-xs font-medium text-muted">
          Open issues
        </p>
        <p
          class="text-4xl font-semibold tabular-nums leading-none tracking-tight"
          :class="issueCount > 0 ? 'text-error' : 'text-highlighted'"
        >
          {{ issueCount }}
        </p>
        <p class="text-xs text-muted">
          {{ issueCount === 1 ? 'finding to review' : 'findings to review' }}
        </p>
      </div>
    </div>

    <ul class="space-y-2">
      <li
        v-for="check in checks"
        :key="check.id"
        class="flex items-center gap-3 rounded-lg border border-default bg-default/40 px-3 py-2.5"
      >
        <UIcon
          :name="stateIcon(check.state)"
          class="size-5 shrink-0"
          :class="stateColor(check.state)"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-highlighted">
            {{ check.label }}
          </p>
          <p class="text-xs text-muted">
            {{ stateLabel(check) }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
