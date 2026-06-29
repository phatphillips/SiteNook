<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { InventoryPageRow } from '~/types/accessiq'
import {
  inventoryBadgeColor,
  inventoryBadgeLabel,
  pageScannedTimestamp
} from '~/utils/inventoryPages'

const props = defineProps<{
  pages: InventoryPageRow[]
  inventory: Record<string, unknown>[]
  refreshing?: boolean
}>()

const tab = ref('pages')

const files = computed(() => props.inventory.filter(i => !i.is_pdf && i.content_type === 'asset'))
const images = computed(() => props.inventory.filter(i => String(i.mime_type || '').startsWith('image/')))
const pdfs = computed(() => props.inventory.filter(i => i.is_pdf))

const tabItems = computed(() => [
  { label: `Pages (${props.pages.length})`, value: 'pages' },
  { label: `Files (${files.value.length})`, value: 'files' },
  { label: `Images (${images.value.length})`, value: 'images' },
  { label: `PDFs (${pdfs.value.length})`, value: 'pdfs' }
])

function formatScanned(page: InventoryPageRow): string {
  const ts = pageScannedTimestamp(page)
  if (!ts) return '—'
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true })
  } catch {
    return ts
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <UTabs
        v-model="tab"
        :items="tabItems"
      />
      <UBadge
        v-if="refreshing"
        color="neutral"
        variant="subtle"
        size="sm"
      >
        Updating…
      </UBadge>
    </div>

    <UTable
      v-if="tab === 'pages'"
      :data="pages"
      :columns="[
        { accessorKey: 'url', header: 'URL' },
        { accessorKey: 'title', header: 'Title' },
        { id: 'badge', header: '' },
        { accessorKey: 'status_code', header: 'Status' },
        { accessorKey: 'word_count', header: 'Words' },
        { accessorKey: 'readability_score', header: 'Readability' },
        { accessorKey: 'crawl_depth', header: 'Depth' },
        { id: 'scanned', header: 'Scanned' }
      ]"
    >
      <template #badge-cell="{ row }">
        <UBadge
          v-if="row.original.inventoryBadge"
          :color="inventoryBadgeColor(row.original.inventoryBadge)"
          variant="subtle"
          size="sm"
        >
          {{ inventoryBadgeLabel(row.original.inventoryBadge) }}
        </UBadge>
      </template>
      <template #scanned-cell="{ row }">
        <span class="text-sm text-muted">{{ formatScanned(row.original) }}</span>
      </template>
    </UTable>

    <UTable
      v-else-if="tab === 'files'"
      :data="files"
      :columns="[
        { accessorKey: 'url', header: 'URL' },
        { accessorKey: 'mime_type', header: 'Mime Type' },
        { accessorKey: 'size_bytes', header: 'Size' }
      ]"
    />

    <UTable
      v-else-if="tab === 'images'"
      :data="images"
      :columns="[
        { accessorKey: 'url', header: 'URL' },
        { accessorKey: 'mime_type', header: 'Type' }
      ]"
    />

    <UTable
      v-else
      :data="pdfs"
      :columns="[
        { accessorKey: 'url', header: 'URL' },
        { accessorKey: 'size_bytes', header: 'Size' },
        { accessorKey: 'pdf_accessibility_score', header: 'A11y Score' }
      ]"
    />
  </div>
</template>
