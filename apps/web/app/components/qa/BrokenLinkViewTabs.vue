<script setup lang="ts">
const view = defineModel<'pages' | 'links'>({ required: true })

const tabItems = [
  { label: 'By page', value: 'pages' },
  { label: 'By link', value: 'links' }
]
</script>

<template>
  <UTabs
    v-model="view"
    :content="false"
    :items="tabItems"
    color="neutral"
    size="sm"
    class="broken-link-view-tabs h-8 shrink-0"
    :ui="{
      list: 'relative flex h-8 p-0.5 rounded-lg bg-elevated border border-default w-auto',
      indicator: 'inset-y-0.5 rounded-md shadow-sm bg-white dark:bg-white',
      trigger: [
        'h-7 grow justify-center px-3 text-sm font-medium min-w-0',
        'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
        'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
      ].join(' ')
    }"
  />
</template>

<style scoped>
.broken-link-view-tabs :deep([role='tab'][data-state='active']) {
  color: rgb(10 10 10);
  z-index: 1;
}

.broken-link-view-tabs :deep([role='tab'][data-state='active'] [data-slot='label']) {
  color: inherit;
}
</style>
