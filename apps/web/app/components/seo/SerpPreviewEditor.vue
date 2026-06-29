<script setup lang="ts">
import type { SeoIssue } from '~/types/accessiq'
import type { SerpDevice } from '~/utils/serpPreview'
import { ruleLabel } from '~/utils/seoRules'
import { isOverSerpLimit, serpLimitsForDevice } from '~/utils/serpPreview'
import { trafficLightClass, trafficLightFromSeverity } from '~/utils/trafficLightStatus'

const url = defineModel<string>('url', { default: '' })
const title = defineModel<string>('title', { default: '' })
const metaDescription = defineModel<string>('metaDescription', { default: '' })
const device = defineModel<SerpDevice>('device', { default: 'mobile' })
const descriptionMax = defineModel<number>('descriptionMax', { default: 157 })
const showDate = defineModel<boolean>('showDate', { default: true })
const showFavicon = defineModel<boolean>('showFavicon', { default: true })

defineProps<{
  fetching?: boolean
  contentIssues?: SeoIssue[]
}>()

const emit = defineEmits<{
  fetch: []
  issueClick: [issue: SeoIssue]
}>()

const deviceItems = [
  { label: 'Mobile', value: 'mobile' as const, icon: 'i-lucide-smartphone' },
  { label: 'Desktop', value: 'desktop' as const, icon: 'i-lucide-monitor' }
]

const titleLimits = computed(() => serpLimitsForDevice(device.value).titleMax)

const titleCounterClass = computed(() =>
  isOverSerpLimit(title.value, titleLimits.value) ? 'text-amber-500' : 'text-muted'
)

const descCounterClass = computed(() =>
  isOverSerpLimit(metaDescription.value, descriptionMax.value) ? 'text-amber-500' : 'text-muted'
)
</script>

<template>
  <div class="space-y-3">
    <UFormField label="URL">
      <div class="flex gap-2">
        <UInput v-model="url" type="url" placeholder="https://example.com/page" class="flex-1" />
        <UButton
          :loading="fetching"
          :disabled="!url.trim()"
          @click="emit('fetch')"
        >
          Fetch
        </UButton>
      </div>
    </UFormField>

    <div v-if="contentIssues?.length" class="flex flex-wrap gap-2">
      <button
        v-for="issue in contentIssues"
        :key="issue.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-default bg-elevated/30 px-2 py-0.5 text-xs transition-colors hover:bg-elevated/60"
        @click="emit('issueClick', issue)"
      >
        <span
          class="size-1.5 shrink-0 rounded-full"
          :class="trafficLightClass(trafficLightFromSeverity(issue.severity))"
        />
        {{ issue.title || ruleLabel(issue.rule_id) }}
      </button>
    </div>

    <UFormField label="Page Title">
      <UInput v-model="title" placeholder="Page title" />
      <p class="text-xs text-right mt-1" :class="titleCounterClass">
        Title {{ title.length }} / {{ titleLimits }}
      </p>
    </UFormField>

    <UFormField label="Meta Description">
      <UTextarea
        v-model="metaDescription"
        :rows="4"
        placeholder="No meta description found — Google may use page body text instead"
      />
      <p class="text-xs text-right mt-1" :class="descCounterClass">
        Description {{ metaDescription.length }} / {{ descriptionMax }}
      </p>
    </UFormField>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="Device" class="min-w-[8rem]">
        <USelectMenu
          v-model="device"
          :items="deviceItems"
          value-key="value"
        />
      </UFormField>
      <UFormField label="Description max length" class="w-28">
        <UInput v-model.number="descriptionMax" type="number" min="80" max="320" />
      </UFormField>
      <UCheckbox v-model="showDate" label="Date" />
      <UCheckbox v-model="showFavicon" label="Favicon" />
    </div>
  </div>
</template>
