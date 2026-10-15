<script setup lang="ts">
import {
  DASHBOARD_SECTION_HEADINGS,
  DASHBOARD_SECTION_VIEW_LABELS,
  type DashboardSectionId
} from '~/utils/dashboardSectionOrder'

const props = withDefaults(defineProps<{
  sectionId: DashboardSectionId
  viewFullTo?: string
  viewFullLabel?: string
  /** When true, render the section H2 (site Overview). Org overview keeps its own titles. */
  showHeading?: boolean
}>(), {
  showHeading: false
})

const resolvedViewLabel = computed(() =>
  props.viewFullLabel ?? DASHBOARD_SECTION_VIEW_LABELS[props.sectionId]
)
</script>

<template>
  <section
    class="dashboard-section relative border-t border-default pt-8 first:border-t-0 first:pt-0"
    :data-section-id="sectionId"
  >
    <div
      v-if="showHeading || viewFullTo"
      class="mb-4 flex items-end justify-between gap-3"
    >
      <div class="min-w-0">
        <h2
          v-if="showHeading"
          class="text-lg font-semibold text-highlighted"
        >
          {{ DASHBOARD_SECTION_HEADINGS[sectionId] }}
        </h2>
      </div>
      <DashboardSectionViewLink
        v-if="viewFullTo"
        :to="viewFullTo"
        :label="resolvedViewLabel"
      />
    </div>

    <div>
      <slot />
    </div>
  </section>
</template>
