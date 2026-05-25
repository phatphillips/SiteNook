<script setup lang="ts">
import type { BrokenLink } from '~/types/accessiq'

const props = defineProps<{
  links: BrokenLink[]
  view: 'pages' | 'links'
}>()

const emit = defineEmits<{ 'update:view': ['pages' | 'links'] }>()

const pagesView = computed(() => {
  const map = new Map<string, { url: string, count: number, links: BrokenLink[] }>()
  for (const link of props.links.filter(l => l.status === 'broken')) {
    const pageUrl = link.expand?.page?.url || link.page
    const existing = map.get(pageUrl) || { url: pageUrl, count: 0, links: [] }
    existing.count++
    existing.links.push(link)
    map.set(pageUrl, existing)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

const linksView = computed(() => {
  const map = new Map<string, { href: string, status_code: number, link_type: string, pages: string[] }>()
  for (const link of props.links.filter(l => l.status === 'broken')) {
    const existing = map.get(link.href) || {
      href: link.href,
      status_code: link.status_code,
      link_type: link.link_type,
      pages: []
    }
    const pageUrl = link.expand?.page?.url || link.page
    if (!existing.pages.includes(pageUrl)) existing.pages.push(pageUrl)
    map.set(link.href, existing)
  }
  return [...map.values()].sort((a, b) => b.pages.length - a.pages.length)
})

function statusColor(code: number) {
  if (code === 404) return 'error'
  if (code >= 500) return 'warning'
  if (code >= 300) return 'info'
  return 'neutral'
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex gap-2">
      <UButton :variant="view === 'pages' ? 'solid' : 'outline'" @click="emit('update:view', 'pages')">Pages View</UButton>
      <UButton :variant="view === 'links' ? 'solid' : 'outline'" @click="emit('update:view', 'links')">Links View</UButton>
    </div>

    <UTable
      v-if="view === 'pages'"
      :data="pagesView"
      :columns="[
        { accessorKey: 'url', header: 'Page URL' },
        { accessorKey: 'count', header: '# Broken Links' }
      ]"
    />

    <UTable
      v-else
      :data="linksView"
      :columns="[
        { accessorKey: 'href', header: 'Broken URL' },
        { accessorKey: 'status_code', header: 'HTTP Status' },
        { accessorKey: 'link_type', header: 'Type' },
        { id: 'pages', header: '# Pages Affected', cell: ({ row }) => row.original.pages.length }
      ]"
    >
      <template #status_code-cell="{ row }">
        <UBadge :color="statusColor(row.original.status_code)">{{ row.original.status_code || 'ERR' }}</UBadge>
      </template>
    </UTable>
  </div>
</template>
