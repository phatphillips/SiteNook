import { h } from 'vue'
import type { Column } from '@tanstack/vue-table'
import DataTableSortHeader from '~/components/shared/DataTableSortHeader.vue'

/** Skeleton bar color. Subtle on table-surface (overrides USkeleton default bg-elevated). */
export const DATA_TABLE_SKELETON_CLASS = 'rounded-md !bg-elevated/30'

/**
 * Shared table chrome — matches Content Explorer (`ContentExplorerSitesTable`).
 * Header: py-3 + text-sm. Sortable labels use DataTableSortHeader (UButton ghost sm).
 */
export const DATA_TABLE_TH_PADDING = 'p-0 px-4 py-3'
export const DATA_TABLE_TD_PADDING = 'p-0 px-4 py-3'
/** Dense body rows only; headers stay the same height as standard tables. */
export const DATA_TABLE_TH_PADDING_DENSE = DATA_TABLE_TH_PADDING
export const DATA_TABLE_TD_PADDING_DENSE = 'p-0 px-4 py-2'

/** Custom HTML `<thead>` row styling. Matches DATA_TABLE_UI thead. */
export const DATA_TABLE_THEAD_CLASS = 'border-b border-default text-left'

const DATA_TABLE_TH_TEXT = 'text-sm font-medium text-muted'
const DATA_TABLE_TD_TEXT = 'align-middle text-sm text-default'

/** UTable `ui` config aligned with DataTableSkeleton / Content Explorer. */
export const DATA_TABLE_UI = {
  root: 'relative w-full overflow-auto',
  base: 'w-full table-fixed border-collapse',
  thead: 'border-b border-default',
  tbody: 'divide-y divide-default',
  th: `${DATA_TABLE_TH_PADDING} ${DATA_TABLE_TH_TEXT} whitespace-normal normal-case`,
  td: `${DATA_TABLE_TD_PADDING} ${DATA_TABLE_TD_TEXT} whitespace-normal overflow-hidden`,
  tr: 'border-b border-default last:border-b-0'
}

/** Nested tables: same header height/text; slightly tighter body cells. */
export const DATA_TABLE_UI_DENSE = {
  ...DATA_TABLE_UI,
  th: `${DATA_TABLE_TH_PADDING_DENSE} ${DATA_TABLE_TH_TEXT} whitespace-normal normal-case`,
  td: `${DATA_TABLE_TD_PADDING_DENSE} ${DATA_TABLE_TD_TEXT} whitespace-normal overflow-hidden`
}

export function dataTableThClass(_dense = false) {
  return `${DATA_TABLE_TH_PADDING} ${DATA_TABLE_TH_TEXT}`
}

export function dataTableTdClass(dense = false) {
  const pad = dense ? DATA_TABLE_TD_PADDING_DENSE : DATA_TABLE_TD_PADDING
  return `${pad} ${DATA_TABLE_TD_TEXT}`
}

/** Sortable header matching Content Explorer (UButton ghost sm, icon + hover). */
export function dataTableSortableHeader<T>(
  column: Column<T, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return h(DataTableSortHeader, {
    label,
    sorted: column.getIsSorted() || false,
    align,
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  })
}

export function dataTableStaticHeader(
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return h('span', {
    class: [
      DATA_TABLE_TH_TEXT,
      align === 'right' ? 'block text-right' : align === 'center' ? 'block text-center' : ''
    ]
  }, label)
}
