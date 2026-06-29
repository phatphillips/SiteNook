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
    class="inline-flex h-8 max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-default bg-default px-2.5 py-1 text-sm transition-colors hover:bg-elevated/50 dark:bg-elevated/50"
    aria-label="Edit site target"
    @click="emit('edit')"
  >
    <span class="text-muted shrink-0">Site target:</span>
    <span
      v-for="row in accessibilityScoreDetailRows(settings)"
      :key="row.id"
      class="site-target-badge"
      :class="row.badgeClass"
    >{{ row.badge }}</span>
    <UIcon name="i-lucide-pencil" class="size-3.5 shrink-0 text-muted" />
  </button>
</template>
