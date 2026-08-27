<template>
  <div class="table-toolbar flex min-h-8 flex-wrap items-center gap-2 sm:h-8 sm:flex-nowrap sm:gap-3 min-w-0">
    <div
      v-if="$slots.leading"
      class="table-toolbar-leading flex h-8 min-w-0 flex-1 items-center gap-1.5 sm:gap-2 sm:shrink-0"
    >
      <slot name="leading" />
    </div>
    <div
      v-if="$slots.actions"
      class="table-toolbar-actions ml-auto flex h-8 shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
