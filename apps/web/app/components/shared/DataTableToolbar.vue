<template>
  <div class="table-toolbar flex h-8 items-center gap-3 min-w-0">
    <div
      v-if="$slots.leading"
      class="table-toolbar-leading flex h-8 items-center shrink-0 min-w-0"
    >
      <slot name="leading" />
    </div>
    <div
      v-if="$slots.actions"
      class="table-toolbar-actions flex h-8 items-center gap-2 ml-auto shrink-0 flex-nowrap"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
