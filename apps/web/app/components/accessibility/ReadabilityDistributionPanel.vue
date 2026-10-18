<script setup lang="ts">
import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'
import { getReadabilityMethod } from '~/utils/readabilityMethods'
import { buildReadabilityDistribution } from '~/utils/readabilityDistribution'

const props = defineProps<{
  methodId: ReadabilityMethodId
  pages: ReadabilityPageRow[]
  selectedBucketId?: string | null
}>()

const emit = defineEmits<{
  'update:selectedBucketId': [bucketId: string | null]
}>()

const open = ref<string[]>(['breakdown'])

const method = computed(() => getReadabilityMethod(props.methodId))

const distribution = computed(() =>
  buildReadabilityDistribution(props.pages, props.methodId)
)

const maxCount = computed(() =>
  Math.max(1, ...distribution.value.map(row => row.count))
)

const scoredPageCount = computed(() =>
  distribution.value.reduce((total, row) => total + row.count, 0)
)

function toggleBucket(bucketId: string) {
  emit('update:selectedBucketId', props.selectedBucketId === bucketId ? null : bucketId)
}
</script>

<template>
  <UAccordion
    v-model="open"
    type="multiple"
    :items="[{ label: 'Page breakdown', value: 'breakdown', slot: 'breakdown' }]"
    :ui="{ item: 'border border-default rounded-lg bg-elevated px-4' }"
  >
    <template #breakdown-body>
      <div class="pb-2">
        <h4 class="text-sm font-medium text-default text-center mb-6">
          Readability score based on:
          <span class="font-semibold">{{ method.label }}</span>
        </h4>

        <p
          v-if="!scoredPageCount"
          class="text-sm text-muted text-center py-6"
        >
          No scored pages yet for this method.
        </p>

        <div
          v-else
          class="space-y-3 max-w-3xl mx-auto"
          role="img"
          :aria-label="`Distribution of ${scoredPageCount} pages by ${method.label}`"
        >
          <div
            v-for="row in distribution"
            :key="row.bucket.id"
            class="grid grid-cols-[9rem_1fr_2rem] items-center gap-3"
          >
            <span class="text-sm text-muted text-right leading-tight">
              {{ row.bucket.label }}
            </span>
            <button
              type="button"
              class="h-7 rounded bg-default/60 overflow-hidden transition ring-1 ring-transparent hover:ring-primary/40"
              :class="{ 'ring-primary bg-primary/10': selectedBucketId === row.bucket.id }"
              :aria-pressed="selectedBucketId === row.bucket.id"
              :title="`Filter table by ${row.bucket.label}`"
              @click="toggleBucket(row.bucket.id)"
            >
              <div
                class="h-full rounded bg-[var(--color-chart-line)] transition-all duration-300"
                :style="{ width: `${(row.count / maxCount) * 100}%` }"
              />
            </button>
            <span class="text-sm tabular-nums text-default text-right">
              {{ row.count }}
            </span>
          </div>
        </div>

        <p class="text-xs text-muted text-center mt-4">
          Pages · {{ scoredPageCount }} scored
          <template v-if="selectedBucketId">
            · Filter active
            <button
              type="button"
              class="ms-1 text-primary hover:underline"
              @click="emit('update:selectedBucketId', null)"
            >
              Clear
            </button>
          </template>
        </p>
      </div>
    </template>
  </UAccordion>
</template>
