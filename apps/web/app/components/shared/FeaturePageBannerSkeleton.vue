<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
</script>

<template>
  <div
    class="feature-page-intro"
    aria-hidden="true"
  >
    <USkeleton :class="`h-4 w-full max-w-xl ${skeleton}`" />
  </div>
</template>
