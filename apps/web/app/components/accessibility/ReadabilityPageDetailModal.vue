<script setup lang="ts">
import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'
import {
  formatReadabilityScore,
  getReadabilityMethod,
  getReadabilityScoreStatus,
  readabilityScoreStatusClass
} from '~/utils/readabilityMethods'
import { bucketForScore } from '~/utils/readabilityDistribution'
import { parsePageUrl } from '~/utils/issueExplanation'
import { htmlSnapshotToPlainText } from '~/utils/readabilityScoring'
import {
  computeReadabilityTextStats,
  formatStatCount,
  interpretGradeLevelScore,
  type ReadabilityTextStats
} from '~/utils/readabilityPageStats'
import ReadabilityCopyPromptButton from '~/components/accessibility/ReadabilityCopyPromptButton.vue'

const props = defineProps<{
  page: ReadabilityPageRow | null
  methodId: ReadabilityMethodId
}>()

const open = defineModel<boolean>('open', { default: false })

const { pb } = usePocketBase()

const method = computed(() => getReadabilityMethod(props.methodId))

const score = computed(() =>
  props.page ? props.page.scores[props.methodId] : null
)

const scoreStatus = computed(() =>
  getReadabilityScoreStatus(props.methodId, score.value)
)

const bucket = computed(() =>
  bucketForScore(props.methodId, score.value)
)

const parsedUrl = computed(() =>
  props.page ? parsePageUrl(props.page.url) : null
)

const interpretation = computed(() => {
  if (score.value == null) return null
  return interpretGradeLevelScore(props.methodId, score.value)
})

const textStats = ref<ReadabilityTextStats | null>(null)
const statsLoading = ref(false)

const displayStats = computed(() => ({
  characterCount: textStats.value?.characterCount ?? null,
  sentenceCount: textStats.value?.sentenceCount ?? null,
  wordCount: textStats.value?.wordCount ?? props.page?.word_count ?? null
}))

watch(
  () => [open.value, props.page?.id] as const,
  async ([isOpen, pageId]) => {
    if (!isOpen || !pageId) {
      textStats.value = null
      return
    }

    statsLoading.value = true
    try {
      const record = await pb.collection('pages').getOne(pageId, {
        fields: 'html_snapshot,word_count'
      })
      const snapshot = String(record.html_snapshot ?? '')
      if (snapshot.trim().length >= 50) {
        textStats.value = computeReadabilityTextStats(
          htmlSnapshotToPlainText(snapshot, props.page?.title)
        )
      } else {
        textStats.value = {
          characterCount: 0,
          sentenceCount: 0,
          wordCount: Number(record.word_count) || props.page?.word_count || 0
        }
      }
    } catch {
      textStats.value = props.page
        ? {
            characterCount: 0,
            sentenceCount: 0,
            wordCount: props.page.word_count || 0
          }
        : null
    } finally {
      statsLoading.value = false
    }
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="page?.title || 'Page readability'"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #description>
      <a
        v-if="parsedUrl && page?.url"
        :href="page.url"
        target="_blank"
        rel="noopener"
        class="inline-block max-w-full truncate text-sm text-primary hover:underline"
        :title="page.url"
      >
        {{ parsedUrl.path }}
      </a>
    </template>

    <template #body>
      <div v-if="page" class="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <div class="rounded-xl border border-default bg-elevated/20 overflow-hidden">
          <div class="p-4 sm:p-5 space-y-3 border-b border-default/80">
            <div class="flex items-center gap-2">
              <span class="readability-badge" :class="method.badgeClass">{{ method.badge }}</span>
              <span class="text-sm font-medium text-default">{{ method.shortLabel }} score</span>
            </div>
            <p
              class="text-4xl font-semibold tabular-nums leading-none"
              :class="readabilityScoreStatusClass(scoreStatus)"
            >
              {{ formatReadabilityScore(score) }}
            </p>
            <div v-if="interpretation" class="space-y-1">
              <p class="text-xs font-medium uppercase tracking-wide text-muted">
                Interpretation
              </p>
              <p class="text-sm text-default">
                {{ interpretation.gradeLabel }}
                <span class="text-muted">·</span>
                {{ interpretation.difficulty }}
              </p>
              <p v-if="bucket && methodId !== 'flesch_reading_ease' && methodId !== 'lix'" class="text-xs text-muted">
                {{ bucket.label }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 divide-x divide-default/80">
            <div class="px-4 py-3 sm:px-5 sm:py-4 space-y-1">
              <p class="text-xs font-medium text-muted">Character count</p>
              <p class="text-lg font-semibold tabular-nums text-default">
                <UIcon
                  v-if="statsLoading"
                  name="i-lucide-loader-circle"
                  class="size-4 animate-spin text-muted"
                />
                <span v-else>{{ formatStatCount(displayStats.characterCount) }}</span>
              </p>
            </div>
            <div class="px-4 py-3 sm:px-5 sm:py-4 space-y-1">
              <p class="text-xs font-medium text-muted">Sentence count</p>
              <p class="text-lg font-semibold tabular-nums text-default">
                <UIcon
                  v-if="statsLoading"
                  name="i-lucide-loader-circle"
                  class="size-4 animate-spin text-muted"
                />
                <span v-else>{{ formatStatCount(displayStats.sentenceCount) }}</span>
              </p>
            </div>
            <div class="px-4 py-3 sm:px-5 sm:py-4 space-y-1">
              <p class="text-xs font-medium text-muted">Word count</p>
              <p class="text-lg font-semibold tabular-nums text-default">
                <UIcon
                  v-if="statsLoading"
                  name="i-lucide-loader-circle"
                  class="size-4 animate-spin text-muted"
                />
                <span v-else>{{ formatStatCount(displayStats.wordCount) }}</span>
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-default bg-elevated/25 p-4 space-y-3">
          <p class="text-sm text-default">{{ method.summary }}</p>
          <p class="text-xs text-muted">
            <span class="font-medium text-default">Best practice:</span>
            {{ method.bestPractice }}
          </p>
          <ReadabilityCopyPromptButton
            :url="page.url"
            :title="page.title"
            :method-id="methodId"
            :score="score"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <UButton
          label="Go to page"
          icon="i-lucide-external-link"
          :to="page?.url"
          target="_blank"
          external
          :disabled="!page?.url"
        />
        <UButton color="neutral" variant="outline" label="Close" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
