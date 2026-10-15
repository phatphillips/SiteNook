<script setup lang="ts">
import type { ContentExplorerEntry, ContentExplorerTreeNode } from '~/types/sitenook'

withDefaults(defineProps<{
  nodes: ContentExplorerTreeNode[]
  selectedIds: Set<string>
  expanded: Set<string>
  activeEntryId?: string | null
  showMultiSelect?: boolean
}>(), {
  showMultiSelect: true
})

const emit = defineEmits<{
  select: [entry: ContentExplorerEntry]
  toggle: [entry: ContentExplorerEntry, checked: boolean]
  'toggle-folder': [node: ContentExplorerTreeNode]
}>()

function hasChildren(node: ContentExplorerTreeNode): boolean {
  return Boolean(node.children?.length)
}

function rowIcon(node: ContentExplorerTreeNode, isOpen: boolean): string {
  if (hasChildren(node)) {
    return isOpen ? 'i-lucide-folder-open' : 'i-lucide-folder'
  }
  if (node.entry) return 'i-lucide-file-text'
  return 'i-lucide-folder'
}
</script>

<template>
  <ul class="space-y-0.5">
    <li
      v-for="node in nodes"
      :key="node.id"
    >
      <div class="flex items-center gap-1">
        <button
          v-if="hasChildren(node)"
          type="button"
          class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-elevated"
          :aria-label="expanded.has(node.id) ? 'Collapse' : 'Expand'"
          @click.stop="emit('toggle-folder', node)"
        >
          <UIcon
            :name="expanded.has(node.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            class="size-3.5"
          />
        </button>
        <span
          v-else
          class="size-7 shrink-0"
          aria-hidden="true"
        />

        <UCheckbox
          v-if="showMultiSelect && node.entry"
          :model-value="selectedIds.has(node.entry.id)"
          :disabled="!node.entry.hasContent"
          :aria-label="`Select ${node.label}`"
          class="shrink-0"
          @update:model-value="emit('toggle', node.entry!, $event === true)"
          @click.stop
        />

        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
          :class="node.entry?.id && node.entry.id === activeEntryId
            ? 'bg-elevated text-highlighted ring-1 ring-inset ring-accented'
            : node.entry
              ? 'text-highlighted hover:bg-elevated'
              : 'text-muted hover:bg-elevated'"
          :aria-current="node.entry?.id && node.entry.id === activeEntryId ? 'true' : undefined"
          @click="node.entry ? emit('select', node.entry) : (hasChildren(node) && emit('toggle-folder', node))"
        >
          <UIcon
            :name="rowIcon(node, expanded.has(node.id))"
            class="size-4 shrink-0 text-muted"
          />
          <span class="min-w-0 flex-1 truncate font-medium">{{ node.label }}</span>
          <UBadge
            v-if="node.entry?.failed"
            color="warning"
            variant="subtle"
            size="xs"
          >
            No content
          </UBadge>
        </button>
      </div>

      <ul
        v-if="hasChildren(node) && expanded.has(node.id)"
        class="ml-4 border-s border-default ps-2"
      >
        <ContentExplorerTreeNodes
          :nodes="node.children!"
          :selected-ids="selectedIds"
          :expanded="expanded"
          :active-entry-id="activeEntryId"
          :show-multi-select="showMultiSelect"
          @select="emit('select', $event)"
          @toggle="(entry, checked) => emit('toggle', entry, checked)"
          @toggle-folder="emit('toggle-folder', $event)"
        />
      </ul>
    </li>
  </ul>
</template>
