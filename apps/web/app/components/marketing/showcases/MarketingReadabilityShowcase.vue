<script setup lang="ts">
import {
  averageGaugePosition,
  averageRawScore
} from '~/utils/readabilityMethods'
import {
  MARKETING_DEMO_READABILITY_METHOD,
  MARKETING_DEMO_READABILITY_PAGES
} from '~/utils/marketingDemoData'

const methodId = MARKETING_DEMO_READABILITY_METHOD
const pages = MARKETING_DEMO_READABILITY_PAGES
const selectedBucketId = ref<string | null>(null)

const gaugePosition = computed(() => averageGaugePosition(pages, methodId))
const averageScore = computed(() => averageRawScore(pages, methodId))
</script>

<template>
  <div class="marketing-readability-showcase space-y-4">
    <h4 class="text-sm font-semibold text-highlighted">
      Readability
    </h4>

    <div class="rounded-lg border border-default bg-elevated/25 p-4 sm:p-5">
      <AccessibilityReadabilityScoreGauge
        :method-id="methodId"
        :position="gaugePosition"
        :raw-score="averageScore"
      />
    </div>

    <AccessibilityReadabilityDistributionPanel
      :method-id="methodId"
      :pages="pages"
      :selected-bucket-id="selectedBucketId"
      @update:selected-bucket-id="selectedBucketId = $event"
    />
  </div>
</template>

<style scoped>
/* Tone down the large “9.1 · Hard” average so it fits the marketing frame. */
.marketing-readability-showcase :deep(.readability-gauge > div:first-child > p:last-child) {
  font-size: 1rem;
  line-height: 1.5rem;
  font-weight: 600;
}
</style>
