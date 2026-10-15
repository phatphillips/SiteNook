<script setup lang="ts">
import type { PdfDocument, PdfStructureOutlineItem } from '~/types/sitenook'

const props = defineProps<{
  document: PdfDocument
  structureLoading?: boolean
  selectedItemId?: string | number | null
}>()

const emit = defineEmits<{
  select: [item: PdfStructureOutlineItem]
}>()

const items = computed(() => props.document.structure_outline?.items ?? [])

function indentPx(item: PdfStructureOutlineItem): number {
  const raw = item.level
  const level = typeof raw === 'number'
    ? raw
    : typeof raw === 'string'
      ? Number.parseInt(raw, 10)
      : 1
  const clamped = Number.isFinite(level) ? Math.max(1, Math.min(6, level)) : 1
  return (clamped - 1) * 10
}

function onSelect(item: PdfStructureOutlineItem) {
  emit('select', item)
}

const emptyMessage = computed(() => {
  if (props.structureLoading
    || props.document.structure_status === 'pending'
    || props.document.structure_status === 'processing') {
    return 'Extracting structure…'
  }
  if (props.document.structure_status === 'failed') {
    return props.document.structure_error || 'Structure extraction failed.'
  }
  return 'No outline yet. Open Convert to extract structure.'
})
</script>

<template>
  <aside
    id="pdf-nav-pane-outline"
    class="pdf-outline-nav flex h-full min-h-0 w-[160px] shrink-0 flex-col border-r border-default bg-elevated"
    aria-label="Document outline"
  >
    <div class="flex h-14 shrink-0 flex-col justify-center border-b border-default px-2.5">
      <h2 class="text-sm font-semibold leading-tight text-highlighted">
        Outline
      </h2>
      <p class="text-xs leading-tight text-muted">
        Jump to a heading
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
      <p
        v-if="!items.length"
        class="px-1.5 py-3 text-sm leading-snug text-muted"
      >
        {{ emptyMessage }}
      </p>

      <ul
        v-else
        class="space-y-0.5"
        role="list"
      >
        <li
          v-for="item in items"
          :key="String(item.id)"
        >
          <button
            type="button"
            class="flex w-full min-h-9 flex-col rounded-md px-2 py-1.5 text-left text-sm
              transition-colors duration-150
              hover:bg-muted/50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            :class="selectedItemId === item.id
              ? 'bg-primary/10 text-highlighted ring-1 ring-primary/30'
              : 'text-muted'"
            :style="{ paddingLeft: `${8 + indentPx(item)}px` }"
            :title="item.content || item.type"
            @click="onSelect(item)"
          >
            <span class="flex items-center gap-1 truncate">
              <span class="font-medium capitalize text-highlighted">{{ item.type }}</span>
              <span
                v-if="item.page"
                class="shrink-0 text-muted"
              >p.{{ item.page }}</span>
            </span>
            <span class="truncate">
              {{ item.content || '—' }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
