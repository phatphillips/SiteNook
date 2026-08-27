<script setup lang="ts">
import { format, parseISO, isValid } from 'date-fns'
import type { OverviewDateRange } from '~/utils/overviewDateRange'

const range = defineModel<OverviewDateRange>({ required: true })

const customOpen = ref(false)
const draftStart = ref('')
const draftEnd = ref('')

const presetItems = [
  { label: '30 days', value: 30 as const },
  { label: '90 days', value: 90 as const }
] as const

function selectPreset(preset: 30 | 90) {
  range.value = { preset }
}

function openCustom() {
  const bounds = overviewRangeBounds(range.value)
  draftStart.value = format(bounds.start, 'yyyy-MM-dd')
  draftEnd.value = format(bounds.end, 'yyyy-MM-dd')
  customOpen.value = true
}

function applyCustom() {
  const start = parseISO(draftStart.value)
  const end = parseISO(draftEnd.value)
  if (!isValid(start) || !isValid(end) || start > end) return
  range.value = {
    preset: 'custom',
    customStart: start,
    customEnd: end
  }
  customOpen.value = false
}

watch(
  () => range.value.preset,
  (preset) => {
    if (preset !== 'custom') customOpen.value = false
  }
)
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2">
    <div
      class="a11y-segmented-control"
      role="group"
      aria-label="Trend period"
    >
      <button
        v-for="item in presetItems"
        :key="item.value"
        type="button"
        class="a11y-segmented-control__btn"
        :aria-pressed="range.preset === item.value"
        @click="selectPreset(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <UPopover v-model:open="customOpen">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        class="h-8"
        :class="range.preset === 'custom' ? 'ring-1 ring-default border-default' : ''"
        @click="openCustom"
      >
        Custom
        <UIcon name="i-lucide-chevron-down" class="size-4 ms-1 opacity-70" />
      </UButton>

      <template #content>
        <div class="p-4 w-72 space-y-4">
          <p class="text-sm font-medium">
            Custom range
          </p>
          <div class="space-y-3">
            <UFormField label="Start">
              <UInput
                v-model="draftStart"
                type="date"
                size="sm"
              />
            </UFormField>
            <UFormField label="End">
              <UInput
                v-model="draftEnd"
                type="date"
                size="sm"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              @click="customOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              size="sm"
              @click="applyCustom"
            >
              Apply
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
