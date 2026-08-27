<script setup lang="ts">
import type { PdfDocument } from '~/types/sitenook'
import { pdfValidationResultLabel, pdfValidationResultTextClass } from '~/utils/pdfStatus'

const props = defineProps<{
  status?: PdfDocument['status']
  issueCount?: number
  ignored?: boolean
}>()

const doc = computed(() => ({
  status: props.status ?? 'pending' as const,
  issue_count: props.issueCount,
  ignored: props.ignored
}))
</script>

<template>
  <span
    class="text-sm"
    :class="pdfValidationResultTextClass(doc)"
  >
    {{ pdfValidationResultLabel(doc) }}
  </span>
</template>
