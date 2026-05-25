<script setup lang="ts">
import type { PageRecord } from '~/types/accessiq'

const props = defineProps<{
  pages: PageRecord[]
  inventory: Record<string, unknown>[]
}>()

const tab = ref('pages')

const files = computed(() => props.inventory.filter(i => !i.is_pdf && i.content_type === 'asset'))
const images = computed(() => props.inventory.filter(i => String(i.mime_type || '').startsWith('image/')))
const pdfs = computed(() => props.inventory.filter(i => i.is_pdf))
</script>

<template>
  <div class="space-y-4">
    <UTabs
      v-model="tab"
      :items="[
        { label: 'Pages', value: 'pages' },
        { label: 'Files', value: 'files' },
        { label: 'Images', value: 'images' },
        { label: 'PDFs', value: 'pdfs' }
      ]"
    />

    <UTable
      v-if="tab === 'pages'"
      :data="pages"
      :columns="[
        { accessorKey: 'url', header: 'URL' },
        { accessorKey: 'title', header: 'Title' },
        { accessorKey: 'status_code', header: 'Status' },
        { accessorKey: 'word_count', header: 'Words' },
        { accessorKey: 'readability_score', header: 'Readability' },
        { accessorKey: 'crawl_depth', header: 'Depth' }
      ]"
    />

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
