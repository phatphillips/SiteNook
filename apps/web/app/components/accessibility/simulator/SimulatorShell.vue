<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/sitenook'
import type { SimulatorVisionId } from '~/utils/simulatorChecks'

const props = defineProps<{
  siteId: string
  pageId: string
  pageUrl?: string | null
  previewLoading?: boolean
  issues: AccessibilityIssue[]
  issuesLoading?: boolean
  selectedIssueId?: string | null
}>()

const visionId = defineModel<SimulatorVisionId>('visionId', { default: 'none' })
const tabOrder = defineModel<boolean>('tabOrder', { default: false })

const emit = defineEmits<{
  selectIssue: [AccessibilityIssue]
}>()
</script>

<template>
  <div class="space-y-4">
    <AccessibilitySimulatorCheckPanel
      v-model:vision-id="visionId"
      v-model:tab-order="tabOrder"
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[32rem]">
      <div class="lg:col-span-2 min-h-[28rem] lg:min-h-[36rem]">
        <AccessibilitySimulatorPreview
          class="h-full min-h-[28rem]"
          :site-id="siteId"
          :page-id="pageId"
          :page-url="pageUrl"
          :loading="previewLoading"
          :vision-id="visionId"
          :tab-order="tabOrder"
        />
      </div>
      <div class="lg:col-span-1 min-h-[20rem] lg:min-h-[36rem]">
        <AccessibilitySimulatorIssuesPanel
          class="h-full"
          :issues="issues"
          :loading="issuesLoading"
          :selected-issue-id="selectedIssueId"
          @select="emit('selectIssue', $event)"
        />
      </div>
    </div>
  </div>
</template>
