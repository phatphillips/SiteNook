<script setup lang="ts">
import type { PdfDocument } from '~/types/accessiq'
import { pdfValidationResultColor, pdfValidationResultLabel } from '~/utils/pdfStatus'

const props = defineProps<{
  status?: PdfDocument['status']
  issueCount?: number
}>()
</script>

<template>
  <UBadge
    :color="pdfValidationResultColor({ status: props.status ?? 'pending', issue_count: props.issueCount })"
    variant="subtle"
    size="sm"
  >
    {{ pdfValidationResultLabel({ status: props.status ?? 'pending', issue_count: props.issueCount }) }}
  </UBadge>
</template>
