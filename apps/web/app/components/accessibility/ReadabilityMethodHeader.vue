<script setup lang="ts">
import type { SiteSettings } from '~/utils/siteSettings'
import { getPrimaryReadabilityMethod, getReadabilityMethod } from '~/utils/readabilityMethods'

const props = defineProps<{
  settings: SiteSettings
}>()

const emit = defineEmits<{
  edit: []
}>()

const primaryMethodId = computed(() => getPrimaryReadabilityMethod(props.settings.readabilityMethods))

const primaryMethod = computed(() =>
  primaryMethodId.value ? getReadabilityMethod(primaryMethodId.value) : null
)
</script>

<template>
  <section v-if="primaryMethod" class="mb-6 rounded-lg border border-default bg-elevated/25 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="readability-badge" :class="primaryMethod.badgeClass">{{ primaryMethod.badge }}</span>
          <h2 class="text-base font-semibold text-default">
            {{ primaryMethod.label }}
          </h2>
        </div>
        <p class="text-sm text-default max-w-3xl">
          {{ primaryMethod.summary }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-default bg-default px-2.5 py-1 text-sm transition-colors hover:bg-elevated/50"
        aria-label="Edit readability methods"
        @click="emit('edit')"
      >
        <span class="text-muted">Method:</span>
        <span class="readability-badge" :class="primaryMethod.badgeClass">{{ primaryMethod.badge }}</span>
        <UIcon name="i-lucide-pencil" class="size-3.5 text-muted" />
      </button>
    </div>
  </section>
</template>
