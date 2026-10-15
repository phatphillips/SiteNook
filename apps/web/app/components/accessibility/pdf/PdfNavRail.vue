<script setup lang="ts">
export type PdfNavMode = 'thumbnails' | 'outline'

const mode = defineModel<PdfNavMode>({ required: true })

const items: Array<{ value: PdfNavMode, label: string, icon: string }> = [
  { value: 'thumbnails', label: 'Thumbnails', icon: 'i-lucide-gallery-thumbnails' },
  { value: 'outline', label: 'Outline', icon: 'i-lucide-list-tree' }
]
</script>

<template>
  <nav
    class="pdf-nav-rail flex w-10 shrink-0 flex-col items-center gap-1 border-r border-default bg-elevated pt-1.5 pb-2"
    aria-label="PDF navigation views"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="relative flex size-8 items-center justify-center rounded-md text-muted
        transition-colors duration-150
        hover:bg-muted/60 hover:text-highlighted
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-elevated"
      :class="mode === item.value
        ? 'bg-primary/15 text-primary'
        : ''"
      :aria-label="item.label"
      :aria-pressed="mode === item.value"
      :aria-controls="`pdf-nav-pane-${item.value}`"
      @click="mode = item.value"
    >
      <span
        v-if="mode === item.value"
        class="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
        aria-hidden="true"
      />
      <UIcon
        :name="item.icon"
        class="size-4"
        aria-hidden="true"
      />
    </button>
  </nav>
</template>
