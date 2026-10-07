<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
</script>

<template>
  <div
    class="feature-page-intro space-y-2"
    aria-hidden="true"
  >
    <USkeleton :class="`h-5 w-2/3 max-w-md sm:h-6 ${skeleton}`" />
    <USkeleton :class="`h-4 w-full max-w-xl ${skeleton}`" />
    <USkeleton :class="`h-4 w-4/5 max-w-lg ${skeleton}`" />
  </div>
</template>
