<script setup lang="ts">
import type { DashboardSectionId } from '~/utils/dashboardSectionOrder'

withDefaults(defineProps<{
  sectionId: DashboardSectionId
  title: string
  viewFullTo?: string
  viewFullLabel?: string
}>(), {
  viewFullLabel: 'View full →'
})
</script>

<template>
  <section
    class="dashboard-section relative border-t border-default pt-8 first:border-t-0 first:pt-0"
    :data-section-id="sectionId"
  >
    <div class="mb-4 flex items-center gap-2.5">
      <button
        type="button"
        class="dashboard-section-drag-handle -ml-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted hover:text-highlighted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:cursor-grabbing"
        aria-label="Drag to reorder section"
        role="button"
        tabindex="0"
        aria-roledescription="sortable"
        aria-describedby="dashboard-dnd-describedby"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </button>

      <h2 class="text-lg font-semibold text-highlighted">
        {{ title }}
      </h2>

      <NuxtLink
        v-if="viewFullTo"
        :to="viewFullTo"
        class="ml-auto text-sm text-muted transition-colors hover:text-primary"
      >
        {{ viewFullLabel }}
      </NuxtLink>
    </div>

    <div>
      <slot />
    </div>
  </section>
</template>
