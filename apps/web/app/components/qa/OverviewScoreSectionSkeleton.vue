<script setup lang="ts">
import { DATA_TABLE_SKELETON_CLASS } from '~/utils/dataTableUi'

const skeleton = DATA_TABLE_SKELETON_CLASS
const rowWidths = ['55%', '70%', '45%', '60%', '35%']
</script>

<template>
  <div
    class="grid gap-4 lg:grid-cols-3 lg:items-stretch"
    aria-hidden="true"
  >
    <div class="flex flex-col items-center gap-4 py-2">
      <USkeleton :class="`h-4 w-24 ${skeleton}`" />
      <USkeleton :class="`size-28 rounded-full ${skeleton}`" />
      <USkeleton :class="`h-3 w-32 ${skeleton}`" />
    </div>

    <div class="lg:col-span-2 rounded-lg border border-default bg-elevated/25 p-4 sm:p-5 space-y-3 min-h-[220px]">
      <USkeleton :class="`h-3 w-28 ${skeleton}`" />
      <USkeleton :class="`h-8 w-20 ${skeleton}`" />
      <USkeleton :class="`h-3 w-40 ${skeleton}`" />
      <USkeleton :class="`h-[88px] w-full rounded ${skeleton}`" />
    </div>

    <div class="rounded-lg border border-default bg-elevated/25 p-4 space-y-3">
      <USkeleton :class="`h-4 w-32 ${skeleton}`" />
      <div
        v-for="(width, index) in rowWidths"
        :key="index"
        class="space-y-2 py-1"
      >
        <div class="flex items-center gap-2">
          <USkeleton :class="`size-[18px] rounded ${skeleton}`" />
          <USkeleton :class="`h-4 flex-1 max-w-[8rem] ${skeleton}`" />
          <USkeleton :class="`h-4 w-6 ${skeleton}`" />
        </div>
        <div class="h-2 rounded-full bg-default/60 overflow-hidden">
          <USkeleton class="h-full rounded-full" :class="skeleton" :style="{ width }" />
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 rounded-lg border border-default bg-elevated/25 p-4 space-y-4">
      <USkeleton :class="`h-4 w-24 ${skeleton}`" />
      <USkeleton :class="`h-3 w-full max-w-md ${skeleton}`" />
      <div class="grid grid-cols-3 gap-3">
        <USkeleton
          v-for="index in 3"
          :key="index"
          :class="`h-16 rounded-lg ${skeleton}`"
        />
      </div>
      <div class="space-y-2">
        <USkeleton
          v-for="index in 3"
          :key="`focus-${index}`"
          :class="`h-12 rounded-lg ${skeleton}`"
        />
      </div>
    </div>
  </div>
</template>
