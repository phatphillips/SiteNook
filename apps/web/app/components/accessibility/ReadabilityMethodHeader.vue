<script setup lang="ts">
import type { SiteSettings } from '~/utils/siteSettings'
import { getPrimaryReadabilityMethod, getReadabilityMethod } from '~/utils/readabilityMethods'
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS

const props = withDefaults(defineProps<{
  settings: SiteSettings
  hideEdit?: boolean
  loading?: boolean
}>(), {
  hideEdit: false,
  loading: false
})

const emit = defineEmits<{
  edit: []
}>()

const primaryMethodId = computed(() => getPrimaryReadabilityMethod(props.settings.readabilityMethods))

const primaryMethod = computed(() =>
  primaryMethodId.value ? getReadabilityMethod(primaryMethodId.value) : null
)
</script>

<template>
  <section
    v-if="loading"
    class="mb-6 rounded-lg border border-default bg-elevated p-4 sm:p-5"
    aria-hidden="true"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <USkeleton :class="`h-6 w-14 rounded-md ${skeleton}`" />
          <USkeleton :class="`h-5 w-48 max-w-full ${skeleton}`" />
        </div>
        <USkeleton :class="`h-4 w-full max-w-3xl ${skeleton}`" />
        <USkeleton :class="`h-4 w-4/5 max-w-2xl ${skeleton}`" />
      </div>
      <USkeleton
        v-if="!hideEdit"
        :class="`h-8 w-36 shrink-0 rounded-lg ${skeleton}`"
      />
    </div>
  </section>

  <section v-else-if="primaryMethod" class="mb-6 rounded-lg border border-default bg-elevated p-4 sm:p-5">
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
        v-if="!hideEdit"
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-default bg-elevated px-2.5 py-1 text-sm transition-colors hover:bg-muted"
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
