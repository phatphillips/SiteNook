<script setup lang="ts">
import type { SiteSettings } from '~/utils/siteSettings'
import { qaTargetBadgeItems } from '~/utils/siteSettings'

const props = defineProps<{
  settings: SiteSettings
}>()

const emit = defineEmits<{
  edit: []
}>()

const items = computed(() => qaTargetBadgeItems(props.settings))
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-default bg-default px-2.5 py-1 text-sm text-default transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)]"
    aria-label="Edit QA report scope"
    @click="emit('edit')"
  >
    <span class="shrink-0 text-toned">QA scope:</span>
    <UTooltip
      v-for="item in items"
      :key="item.id"
      :text="`${item.label}: ${item.enabled ? 'Included in reports' : 'Hidden from reports'}`"
      :popper="{ placement: 'top' }"
    >
      <span
        class="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md border transition-colors"
        :class="item.enabled
          ? 'border-default bg-elevated text-default'
          : 'border-transparent bg-transparent text-toned opacity-55'"
        :aria-label="item.label"
      >
        <UIcon :name="item.icon" class="size-3.5" aria-hidden="true" />
      </span>
    </UTooltip>
    <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-toned" aria-hidden="true" />
  </button>
</template>
