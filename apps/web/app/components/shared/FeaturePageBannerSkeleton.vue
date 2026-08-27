<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
</script>

<template>
  <section
    class="feature-page-banner flex items-stretch overflow-hidden rounded-xl border border-default bg-elevated/40 px-5 sm:px-6"
    aria-hidden="true"
  >
    <div class="flex min-w-0 flex-1 flex-col justify-center py-4 sm:py-5 space-y-2">
      <USkeleton :class="`h-5 w-2/3 max-w-md sm:h-6 ${skeleton}`" />
      <USkeleton :class="`h-4 w-full max-w-xl ${skeleton}`" />
      <USkeleton :class="`h-4 w-4/5 max-w-lg ${skeleton}`" />
    </div>
  </section>
</template>

<style scoped>
.feature-page-banner {
  height: calc(var(--spacing) * 30);
}
</style>
