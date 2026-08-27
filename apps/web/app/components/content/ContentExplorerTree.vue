<script setup lang="ts">
import type { ContentExplorerEntry, ContentExplorerTreeNode } from '~/types/sitenook'
import { buildContentExplorerTree, filterContentExplorerTree } from '~/utils/contentExplorerTree'

const props = defineProps<{
  entries: ContentExplorerEntry[]
  loading?: boolean
  selectedIds: Set<string>
  activeEntryId?: string | null
}>()

const emit = defineEmits<{
  select: [entry: ContentExplorerEntry]
  toggle: [entry: ContentExplorerEntry, checked: boolean]
  'toggle-all': [checked: boolean]
}>()

const search = defineModel<string>('search', { default: '' })
const expanded = ref<Set<string>>(new Set())

function isHomepageNode(node: ContentExplorerTreeNode): boolean {
  if (node.path === '/') return true
  if (!node.entry?.url) return false
  try {
    const path = new URL(node.entry.url).pathname.replace(/\/+$/, '') || '/'
    return path === '/'
  } catch {
    return false
  }
}

function explorerNodeRank(node: ContentExplorerTreeNode): number {
  if (node.children?.length) return 0
  if (isHomepageNode(node)) return 1
  return 2
}

function orderExplorerNodes(nodes: ContentExplorerTreeNode[]): ContentExplorerTreeNode[] {
  return nodes
    .map(node => ({
      ...node,
      children: node.children?.length ? orderExplorerNodes(node.children) : node.children
    }))
    .sort((a, b) => {
      const rankDelta = explorerNodeRank(a) - explorerNodeRank(b)
      if (rankDelta !== 0) return rankDelta
      return a.label.localeCompare(b.label)
    })
}

const tree = computed(() => orderExplorerNodes(buildContentExplorerTree(props.entries)))
const filteredTree = computed(() => filterContentExplorerTree(tree.value, search.value))


const flatPages = computed(() => props.entries.filter(e => e.hasContent || !e.failed))

function ancestorIdsForEntry(
  nodes: ContentExplorerTreeNode[],
  entryId: string,
  trail: string[] = []
): string[] | null {
  for (const node of nodes) {
    if (node.entry?.id === entryId) return trail
    if (node.children?.length) {
      const found = ancestorIdsForEntry(node.children, entryId, [...trail, node.id])
      if (found) return found
    }
  }
  return null
}

watch(() => props.activeEntryId, (id) => {
  if (!id) return
  const ancestors = ancestorIdsForEntry(filteredTree.value, id)
  if (!ancestors?.length) return
  const next = new Set(expanded.value)
  let changed = false
  for (const ancestorId of ancestors) {
    if (!next.has(ancestorId)) {
      next.add(ancestorId)
      changed = true
    }
  }
  if (changed) expanded.value = next
}, { immediate: true })

function toggleFolder(node: ContentExplorerTreeNode) {
  const next = new Set(expanded.value)
  if (next.has(node.id)) next.delete(node.id)
  else next.add(node.id)
  expanded.value = next
}

function onToggle(entry: ContentExplorerEntry, checked: boolean) {
  emit('toggle', entry, checked)
}

function allSelected(): boolean {
  const exportable = flatPages.value
  if (!exportable.length) return false
  return exportable.every(e => props.selectedIds.has(e.id))
}

function onToggleAll(checked: boolean) {
  emit('toggle-all', checked)
}

function onToggleAllModelValue(value: boolean | 'indeterminate') {
  onToggleAll(value === true)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-default">
    <div class="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-default px-3 text-xs text-muted">
        <label class="inline-flex items-center gap-2">
          <UCheckbox
            :model-value="allSelected()"
            aria-label="Select all pages"
            @update:model-value="onToggleAllModelValue"
          />
          <span>{{ selectedIds.size }} selected</span>
        </label>
    </div>

    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center p-6 text-sm text-muted"
    >
      Loading pages…
    </div>
    <div
      v-else-if="!filteredTree.length"
      class="flex flex-1 items-center justify-center p-6 text-sm text-muted"
    >
      No pages found for the latest scan.
    </div>
    <div
      v-else
      class="min-h-0 flex-1 overflow-auto p-2"
    >
      <ContentExplorerTreeNodes
        :nodes="filteredTree"
        :selected-ids="selectedIds"
        :expanded="expanded"
        :active-entry-id="activeEntryId"
        @select="emit('select', $event)"
        @toggle="onToggle"
        @toggle-folder="toggleFolder"
      />
    </div>
  </div>
</template>
