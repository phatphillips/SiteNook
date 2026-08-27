<script setup lang="ts">
import type { PdfDocumentStatus } from '~/types/sitenook'
import { pdfCheckPassed } from '~/utils/pdfStatus'

const props = defineProps<{
  value?: boolean
  status?: PdfDocumentStatus
}>()

const state = computed(() => pdfCheckPassed(props.value, props.status))
</script>

<template>
  <UIcon
    v-if="state === true"
    name="i-lucide-circle-check"
    class="size-5 text-success"
  />
  <UIcon
    v-else-if="state === false"
    name="i-lucide-circle-x"
    class="size-5 text-error"
  />
  <span
    v-else
    class="text-sm text-muted"
  >—</span>
</template>
