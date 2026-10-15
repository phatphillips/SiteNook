<script setup lang="ts">
import type { SiteSettings } from '~/utils/siteSettings'
import { accessibilityScoreDetailRows } from '~/utils/siteSettings'

defineProps<{
  settings: SiteSettings
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-default bg-default px-2.5 py-1 text-sm text-default transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)]"
    aria-label="Edit site target"
    @click="emit('edit')"
  >
    <span class="shrink-0 text-toned">Site target:</span>
    <span
      v-for="row in accessibilityScoreDetailRows(settings)"
      :key="row.id"
      class="site-target-badge"
      :class="row.badgeClass"
      aria-hidden="true"
    >{{ row.badge }}</span>
    <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-toned" aria-hidden="true" />
  </button>
</template>
