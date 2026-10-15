<script setup lang="ts">
import { format, parseISO, isValid } from 'date-fns'
import type { OverviewDateRange } from '~/utils/overviewDateRange'

const range = defineModel<OverviewDateRange>({ required: true })

const customOpen = ref(false)
const draftStart = ref('')
const draftEnd = ref('')

const presetTabItems = [
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' }
]

const activePreset = computed({
  get(): string {
    const preset = range.value.preset
    if (preset === 30) return '30'
    if (preset === 90) return '90'
    return ''
  },
  set(value: string) {
    if (value === '30') selectPreset(30)
    if (value === '90') selectPreset(90)
  }
})

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
    <UTabs
      v-model="activePreset"
      :content="false"
      :items="presetTabItems"
      color="neutral"
      size="sm"
      class="overview-date-range-tabs h-8 shrink-0"
      :ui="{
        list: 'relative flex h-8 w-auto p-0.5 rounded-lg bg-elevated border border-default',
        indicator: 'inset-y-0.5 rounded-md shadow-sm bg-default',
        trigger: [
          'h-7 grow justify-center px-3 text-sm font-medium min-w-0',
          'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
          'data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-highlighted'
        ].join(' ')
      }"
    />

    <UPopover v-model:open="customOpen">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        class="h-8"
        :aria-pressed="range.preset === 'custom'"
        :ui="{
          base: range.preset === 'custom'
            ? 'h-8 border border-default ring-1 ring-primary/30'
            : 'h-8'
        }"
        @click="openCustom"
      >
        Custom
        <UIcon name="i-lucide-chevron-down" class="ms-1 size-4 opacity-80" aria-hidden="true" />
      </UButton>

      <template #content>
        <div class="w-72 space-y-4 p-4">
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
