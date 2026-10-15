<script setup lang="ts">
import type { SeoIssue } from '~/types/sitenook'
import type { SerpDevice } from '~/utils/serpPreview'
import { ruleLabel } from '~/utils/seoRules'
import { isOverSerpLimit, serpLimitsForDevice } from '~/utils/serpPreview'
import { trafficLightClass, trafficLightFromSeverity } from '~/utils/trafficLightStatus'

const title = defineModel<string>('title', { default: '' })
const metaDescription = defineModel<string>('metaDescription', { default: '' })
const device = defineModel<SerpDevice>('device', { default: 'mobile' })
const descriptionMax = defineModel<number>('descriptionMax', { default: 157 })
const showDate = defineModel<boolean>('showDate', { default: true })
const showFavicon = defineModel<boolean>('showFavicon', { default: true })

defineProps<{
  contentIssues?: SeoIssue[]
}>()

const emit = defineEmits<{
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

const deviceMenuOpen = ref(false)
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="contentIssues?.length"
      class="space-y-2"
    >
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Content issues on this page
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="issue in contentIssues"
          :key="issue.id"
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-default bg-elevated px-2 py-1 text-xs transition-colors hover:bg-muted"
          @click="emit('issueClick', issue)"
        >
          <span
            class="size-1.5 shrink-0 rounded-full"
            :class="trafficLightClass(trafficLightFromSeverity(issue.severity))"
          />
          {{ issue.title || ruleLabel(issue.rule_id) }}
        </button>
      </div>
    </div>

    <section class="space-y-4">
      <UFormField
        label="Page title"
        class="w-full"
        :ui="{ hint: titleCounterClass }"
      >
        <template #hint>
          <span class="tabular-nums">{{ title.length }} / {{ titleLimits }}</span>
        </template>
        <UInput
          v-model="title"
          placeholder="Page title"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Meta description"
        class="w-full"
        :ui="{ hint: descCounterClass }"
      >
        <template #hint>
          <span class="tabular-nums">{{ metaDescription.length }} / {{ descriptionMax }}</span>
        </template>
        <UTextarea
          v-model="metaDescription"
          :rows="4"
          class="w-full"
          placeholder="No meta description found. Google may use page body text instead"
        />
      </UFormField>
    </section>

    <section class="space-y-3 border-t border-default pt-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted">
        Preview options
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UFormField label="Device">
          <USelectMenu
            v-model="device"
            v-model:open="deviceMenuOpen"
            :items="deviceItems"
            value-key="value"
            :search-input="false"
            class="w-full"
            @update:model-value="deviceMenuOpen = false"
          />
        </UFormField>
        <div class="flex flex-wrap items-end gap-4 pb-1">
          <UCheckbox
            v-model="showDate"
            label="Date"
          />
          <UCheckbox
            v-model="showFavicon"
            label="Favicon"
          />
        </div>
      </div>
      <UFormField
        label="Description max length"
        help="Characters shown before truncation in the preview."
        class="max-w-[12rem]"
      >
        <UInput
          v-model.number="descriptionMax"
          type="number"
          min="80"
          max="320"
        />
      </UFormField>
    </section>
  </div>
</template>
