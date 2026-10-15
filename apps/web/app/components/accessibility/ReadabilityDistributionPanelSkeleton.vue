<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS

const rowWidths = ['45%', '55%', '70%', '60%', '80%', '95%']
</script>

<template>
  <div
    class="rounded-lg border border-default bg-elevated px-4 py-4"
    aria-hidden="true"
  >
    <div class="flex items-center justify-between gap-3 pb-3 border-b border-default">
      <USkeleton :class="`h-4 w-32 ${skeleton}`" />
      <USkeleton :class="`h-4 w-4 rounded ${skeleton}`" />
    </div>

    <div class="pb-2 pt-4">
      <div class="flex justify-center mb-6">
        <USkeleton :class="`h-4 w-64 max-w-full ${skeleton}`" />
      </div>

      <div class="space-y-3 max-w-3xl mx-auto">
        <div
          v-for="(width, index) in rowWidths"
          :key="index"
          class="grid grid-cols-[9rem_1fr_2rem] items-center gap-3"
        >
          <USkeleton :class="`h-4 w-full ms-auto ${skeleton}`" />
          <div class="h-7 rounded bg-default/60 overflow-hidden">
            <USkeleton
              class="h-full rounded"
              :class="skeleton"
              :style="{ width }"
            />
          </div>
          <USkeleton :class="`h-4 w-6 ms-auto ${skeleton}`" />
        </div>
      </div>

      <div class="flex justify-center mt-4">
        <USkeleton :class="`h-3 w-28 ${skeleton}`" />
      </div>
    </div>
  </div>
</template>
