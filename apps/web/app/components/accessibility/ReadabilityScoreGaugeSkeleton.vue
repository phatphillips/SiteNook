<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
</script>

<template>
  <div class="readability-gauge space-y-2" aria-hidden="true">
    <div class="flex items-baseline justify-between gap-4">
      <USkeleton :class="`h-4 w-36 ${skeleton}`" />
      <USkeleton :class="`h-8 w-16 ${skeleton}`" />
    </div>

    <div class="relative pt-6 pb-1">
      <USkeleton :class="`h-3 w-full rounded-full ${skeleton}`" />
      <div class="absolute top-0 left-1/2 flex flex-col items-center -translate-x-1/2">
        <USkeleton :class="`h-3 w-10 mb-0.5 ${skeleton}`" />
        <USkeleton :class="`h-5 w-0.5 ${skeleton}`" />
      </div>
    </div>

    <div class="flex justify-between px-0.5">
      <USkeleton
        v-for="i in 11"
        :key="i"
        :class="`h-3 w-4 ${skeleton}`"
      />
    </div>

    <USkeleton :class="`h-3 w-full max-w-md ${skeleton}`" />
  </div>
</template>
