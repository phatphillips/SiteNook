<script setup lang="ts">
import type { ScoreBreakdownModel, ScoreBreakdownSlice } from '~/utils/scoreBreakdown'
import { DONUT_SEGMENT_TOKENS } from '~/utils/donutChart'

const props = defineProps<{
  open: boolean
  model: ScoreBreakdownModel | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

const { chartStyle } = useDonutChartStyle()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const slices = computed((): ScoreBreakdownSlice[] => {
  const list = props.model?.slices ?? []
  return list
    .filter(slice => slice.value > 0)
    .map((slice, index) => ({
      ...slice,
      color: slice.color || DONUT_SEGMENT_TOKENS[index % DONUT_SEGMENT_TOKENS.length]!
    }))
})

const donutSegments = computed(() =>
  slices.value.map(slice => ({
    label: slice.label,
    value: slice.value,
    color: slice.color
  }))
)

const rightRows = computed(() => {
  if (props.model?.rows?.length) return props.model.rows
  const actionable = slices.value.filter(slice =>
    slice.id !== 'remaining' && (slice.score != null || slice.detail || slice.href || slice.impact)
  )
  return actionable.length ? actionable : slices.value
})

const deltaClass = computed(() => {
  const delta = props.model?.delta
  if (!delta) return 'text-muted'
  if (delta.startsWith('+')) return 'text-success'
  if (delta.startsWith('-')) return 'text-error'
  return 'text-muted'
})

const statColumnCount = computed(() => {
  const stats = props.model?.stats?.length ?? 0
  const delta = props.model?.delta ? 1 : 0
  return Math.max(1, stats + delta)
})

const statsGridClass = computed(() => {
  const count = statColumnCount.value
  if (count >= 3) return 'grid w-full grid-cols-1 gap-2 sm:grid-cols-3'
  if (count === 2) return 'grid w-full grid-cols-1 gap-2 sm:grid-cols-2'
  return 'grid w-full grid-cols-1 gap-2'
})

function slicePrimaryValue(slice: ScoreBreakdownSlice): string {
  if (slice.score != null) return `${Math.round(slice.score * 10) / 10}%`
  return String(slice.value)
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="model?.title || 'Score breakdown'"
    :description="model?.description"
    :ui="{ content: 'sm:max-w-3xl', description: 'text-muted' }"
  >
    <template v-if="model" #body>
      <div class="flex flex-col gap-6">
        <!-- Top: donut + each slice's information to its right -->
        <section class="grid gap-5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center">
          <div class="flex flex-col items-center gap-2 sm:items-start">
            <div class="size-44">
              <AccessibilityScoreDonut
                class="!size-full"
                :score="model.score"
                :segments="donutSegments"
                :sort-segments="model.sortSlices ?? false"
                :unit="model.unit ?? '%'"
                :caption="model.caption || model.title"
                :chart-style="chartStyle"
                size="lg"
              />
            </div>
            <UTooltip
              v-if="model.scoreExplainer"
              :text="model.scoreExplainer"
              :popper="{ placement: 'bottom' }"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-default"
                :aria-label="model.scoreExplainerLabel || 'How the score is calculated'"
              >
                <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0" />
                <span>{{ model.scoreExplainerLabel || 'How the score is calculated' }}</span>
              </button>
            </UTooltip>
          </div>

          <ul class="grid gap-2 sm:grid-cols-1" aria-label="Donut slice information">
            <li
              v-for="slice in slices"
              :key="`slice-${slice.id}`"
              class="flex items-start gap-3 rounded-xl border border-default bg-muted/25 px-3 py-2.5"
            >
              <span
                class="mt-1 size-3 shrink-0 rounded-full ring-2 ring-default/40"
                :style="{ backgroundColor: slice.color }"
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="truncate text-sm font-semibold text-highlighted">
                    {{ slice.label }}
                  </p>
                  <p class="shrink-0 text-sm font-bold tabular-nums text-default">
                    {{ slicePrimaryValue(slice) }}
                  </p>
                </div>
                <p v-if="slice.detail" class="mt-0.5 text-xs text-muted">
                  {{ slice.detail }}
                </p>
                <p v-if="slice.impact" class="mt-0.5 text-xs font-medium text-default">
                  {{ slice.impact }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <!-- Useful next-step detail -->
        <div class="flex min-w-0 flex-col gap-5">
          <section
            v-if="model.stats?.length || model.delta"
            :class="statsGridClass"
          >
            <div
              v-if="model.delta"
              class="min-w-0 rounded-lg border border-default bg-muted/30 px-3 py-2"
            >
              <p class="text-xs text-muted">{{ model.deltaLabel || 'Since last scan' }}</p>
              <p class="mt-0.5 text-base font-semibold tabular-nums" :class="deltaClass">
                {{ model.delta }}
              </p>
            </div>
            <div
              v-for="stat in model.stats || []"
              :key="stat.label"
              class="min-w-0 rounded-lg border border-default bg-muted/30 px-3 py-2"
            >
              <p class="text-xs text-muted">{{ stat.label }}</p>
              <p class="mt-0.5 text-base font-semibold tabular-nums text-highlighted">
                {{ stat.value }}
              </p>
              <p v-if="stat.hint" class="mt-0.5 text-[11px] text-muted">{{ stat.hint }}</p>
            </div>
          </section>

          <section>
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Where to focus
            </h4>
            <ul class="divide-y divide-default rounded-lg border border-default">
              <li
                v-for="row in rightRows"
                :key="`row-${row.id}`"
              >
                <NuxtLink
                  v-if="row.href"
                  :to="row.href"
                  class="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  @click="openModel = false"
                >
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2">
                      <span class="truncate text-sm font-medium text-highlighted">{{ row.label }}</span>
                      <span
                        v-if="row.score != null"
                        class="shrink-0 text-sm font-semibold tabular-nums text-default"
                      >{{ Math.round(row.score) }}%</span>
                    </span>
                    <span
                      v-if="row.detail || row.impact"
                      class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
                    >
                      <span v-if="row.detail">{{ row.detail }}</span>
                      <UBadge
                        v-if="row.impact"
                        color="primary"
                        variant="subtle"
                        size="sm"
                        class="font-medium"
                      >
                        {{ row.impact }}
                      </UBadge>
                    </span>
                  </span>
                  <UIcon name="i-lucide-chevron-right" class="mt-0.5 size-4 shrink-0 text-muted" />
                </NuxtLink>
                <div
                  v-else
                  class="flex items-start gap-3 px-3 py-2.5"
                >
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center justify-between gap-2">
                      <span class="truncate text-sm font-medium text-highlighted">{{ row.label }}</span>
                      <span
                        v-if="row.score != null"
                        class="shrink-0 text-sm font-semibold tabular-nums text-default"
                      >{{ Math.round(row.score) }}%</span>
                    </span>
                    <span
                      v-if="row.detail || row.impact"
                      class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
                    >
                      <span v-if="row.detail">{{ row.detail }}</span>
                      <UBadge
                        v-if="row.impact"
                        color="primary"
                        variant="subtle"
                        size="sm"
                        class="font-medium"
                      >
                        {{ row.impact }}
                      </UBadge>
                    </span>
                  </span>
                </div>
              </li>
            </ul>
            <p v-if="model.footnote" class="mt-2 text-xs text-muted">
              {{ model.footnote }}
            </p>
          </section>
        </div>
      </div>
    </template>

    <template v-if="model?.ctaTo" #footer>
      <div class="flex justify-end">
        <UButton
          :to="model.ctaTo"
          color="primary"
          @click="openModel = false"
        >
          {{ model.ctaLabel || 'View details' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
