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
    class="inline-flex h-8 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-default bg-default px-2.5 py-1 text-sm transition-colors hover:bg-elevated/50 dark:bg-elevated/50"
    aria-label="Edit QA report scope"
    @click="emit('edit')"
  >
    <span class="text-muted shrink-0">QA scope:</span>
    <UTooltip
      v-for="item in items"
      :key="item.id"
      :text="`${item.label}: ${item.enabled ? 'Included in reports' : 'Hidden from reports'}`"
      :popper="{ placement: 'top' }"
    >
      <span
        class="inline-flex size-[22px] items-center justify-center rounded-md shrink-0 transition-opacity"
        :class="item.enabled ? 'bg-elevated/80 text-default' : 'bg-elevated/30 text-muted opacity-50'"
        :aria-label="item.label"
      >
        <UIcon :name="item.icon" class="size-3.5" />
      </span>
    </UTooltip>
    <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-muted" />
  </button>
</template>
