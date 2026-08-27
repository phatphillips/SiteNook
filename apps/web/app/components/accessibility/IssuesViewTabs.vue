<script setup lang="ts">
const pageTab = defineModel<'issues' | 'pages'>({ required: true })

const tabItems = [
  { label: 'Issues', value: 'issues' },
  { label: 'Pages', value: 'pages' }
]
</script>

<template>
  <UTabs
    v-model="pageTab"
    :content="false"
    :items="tabItems"
    color="neutral"
    size="sm"
    class="issues-view-tabs h-8 shrink-0"
    :ui="{
      list: 'relative flex h-8 p-0.5 rounded-lg bg-default dark:bg-elevated/50 border border-default w-auto',
      indicator: 'inset-y-0.5 rounded-md shadow-sm bg-white dark:bg-white',
      trigger: [
        'h-7 grow justify-center px-2 sm:px-3 text-sm font-medium min-w-0',
        'data-[state=inactive]:text-muted hover:data-[state=inactive]:not-disabled:text-default',
        'data-[state=active]:bg-transparent data-[state=active]:shadow-none'
      ].join(' ')
    }"
  />
</template>

<style scoped>
.issues-view-tabs :deep([role='tab'][data-state='active']) {
  color: rgb(10 10 10);
  z-index: 1;
}

.issues-view-tabs :deep([role='tab'][data-state='active'] [data-slot='label']) {
  color: inherit;
}
</style>
