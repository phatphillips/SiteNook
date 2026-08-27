<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
</script>

<template>
  <div
    class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    aria-hidden="true"
  >
    <div
      v-for="index in 5"
      :key="index"
      class="rounded-lg border border-default bg-elevated/40 p-4 space-y-3"
    >
      <div class="flex items-center gap-2">
        <USkeleton :class="`size-2 rounded-full ${skeleton}`" />
        <USkeleton :class="`h-4 w-24 ${skeleton}`" />
      </div>
      <USkeleton :class="`h-8 w-12 ${skeleton}`" />
      <USkeleton :class="`h-3 w-full max-w-[12rem] ${skeleton}`" />
    </div>
  </div>
</template>
