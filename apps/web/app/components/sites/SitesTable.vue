<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Site } from '~/types/accessiq'
import { formatNextScanLabel } from '~/utils/scheduleNextRun'

const props = withDefaults(defineProps<{
  sites: Site[]
  canWrite?: boolean
}>(), {
  canWrite: false
})

const emit = defineEmits<{
  edit: [site: Site]
}>()

const UCheckbox = resolveComponent('UCheckbox')
const UButton = resolveComponent('UButton')

function onEditSite(site: Site) {
  emit('edit', site)
}

const table = useTemplateRef('table')
const rowSelection = ref<Record<string, boolean>>({})
const tableSearch = ref('')
const columnVisibility = ref<Record<string, boolean>>({
  crawl_schedule: true,
  next_scan: true,
  actions: true
})

const COLUMN_LABELS: Record<string, string> = {
  crawl_schedule: 'Frequency',
  next_scan: 'Next scan',
  actions: 'Actions'
}

const columns = computed<TableColumn<Site>[]>(() => {
  const base: TableColumn<Site>[] = [
    {
      id: 'site',
      accessorFn: row => `${row.name} ${row.url}`,
      header: 'Site',
      enableHiding: false
    },
    { accessorKey: 'crawl_schedule', header: 'Frequency' },
    { id: 'next_scan', header: 'Next scan' }
  ]

  if (!props.canWrite) {
    return base
  }

  return [
    {
      id: 'select',
      enableHiding: false,
      enableSorting: false,
      header: ({ table: t }) =>
        h(UCheckbox, {
          'modelValue': t.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : t.getIsAllPageRowsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
            t.toggleAllPageRowsSelected(!!value),
          'ariaLabel': 'Select all sites'
        }),
      cell: ({ row }) =>
        h(UCheckbox, {
          'modelValue': row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
          'ariaLabel': 'Select site'
        })
    },
    ...base,
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      meta: { class: { td: 'text-right' } },
      cell: ({ row }) =>
        h(UButton, {
          type: 'button',
          icon: 'i-lucide-pencil',
          color: 'neutral',
          variant: 'ghost',
          size: 'sm',
          'aria-label': 'Edit site settings',
          onClick: (e: Event) => {
            e.stopPropagation()
            onEditSite(row.original)
          }
        })
    }
  ]
})

const columnMenuItems = computed(() => {
  const api = table.value?.tableApi
  if (!api) return []
  return api.getAllColumns()
    .filter(column => column.getCanHide())
    .map(column => ({
      label: COLUMN_LABELS[column.id] ?? column.id,
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        api.getColumn(column.id)?.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      }
    }))
})

const selectedCount = computed(() =>
  table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
)

defineExpose({
  selectedCount,
  table,
  clearSelection() {
    rowSelection.value = {}
  }
})
</script>

<template>
  <div class="sites-table-panel space-y-4">
    <DataTableToolbar>
      <template #actions>
        <TableSearchInput
          v-model="tableSearch"
          placeholder="Search sites…"
          aria-label="Search sites"
        />
        <UDropdownMenu :items="columnMenuItems">
          <TableToolbarMenuButton label="Columns" icon="i-lucide-columns-3" />
        </UDropdownMenu>
      </template>
    </DataTableToolbar>

    <div class="rounded-lg border border-default overflow-hidden">
      <UTable
        ref="table"
        v-model:row-selection="rowSelection"
        v-model:global-filter="tableSearch"
        v-model:column-visibility="columnVisibility"
        :data="props.sites"
        :columns="columns"
        :ui="{ root: 'relative w-full' }"
      >
        <template #site-cell="{ row }">
          <div class="min-w-0">
            <NuxtLink
              :to="`/sites/${row.original.id}`"
              class="text-primary hover:underline font-medium"
            >
              {{ row.original.name }}
            </NuxtLink>
            <p class="text-sm text-muted truncate" :title="row.original.url">
              {{ row.original.url }}
            </p>
          </div>
        </template>
        <template #crawl_schedule-cell="{ row }">
          <span class="capitalize">{{ row.original.crawl_schedule?.replace('_', ' ') ?? 'manual' }}</span>
        </template>
        <template #next_scan-cell="{ row }">
          <span class="text-muted text-sm">
            {{ formatNextScanLabel(row.original.crawl_schedule, row.original.schedule_next_run_at) }}
          </span>
        </template>
      </UTable>
    </div>

    <p v-if="selectedCount" class="text-sm text-muted">
      {{ selectedCount }} site(s) selected.
    </p>
  </div>
</template>
