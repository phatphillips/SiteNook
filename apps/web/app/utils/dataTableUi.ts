import { h, resolveComponent } from 'vue'
import type { Column } from '@tanstack/vue-table'

/** Skeleton bar color. Subtle on table-surface (overrides USkeleton default bg-elevated). */
export const DATA_TABLE_SKELETON_CLASS = 'rounded-md !bg-elevated/30'

export const DATA_TABLE_TH_PADDING = 'p-0 px-4 py-3'
export const DATA_TABLE_TD_PADDING = 'p-0 px-4 py-3'
export const DATA_TABLE_TH_PADDING_DENSE = 'p-0 px-4 py-2'
export const DATA_TABLE_TD_PADDING_DENSE = 'p-0 px-4 py-2'

/** Custom HTML `<thead>` row styling. Matches DATA_TABLE_UI thead. */
export const DATA_TABLE_THEAD_CLASS = 'border-b border-default bg-elevated/20 text-left'

/** UTable `ui` config aligned with DataTableSkeleton (muted headers, fixed layout, row dividers). */
export const DATA_TABLE_UI = {
  root: 'relative w-full',
  base: 'w-full table-fixed border-collapse',
  thead: 'bg-elevated/20 border-b border-default',
  tbody: 'divide-y divide-default',
  th: `${DATA_TABLE_TH_PADDING} text-xs font-medium text-muted whitespace-normal`,
  td: `${DATA_TABLE_TD_PADDING} align-middle text-sm text-default whitespace-normal`,
  tr: 'border-b border-default last:border-b-0'
}

/** Nested / compact tables (e.g. affected pages inside an expanded row). */
export const DATA_TABLE_UI_DENSE = {
  ...DATA_TABLE_UI,
  th: `${DATA_TABLE_TH_PADDING_DENSE} text-xs font-medium text-muted whitespace-normal`,
  td: `${DATA_TABLE_TD_PADDING_DENSE} align-middle text-sm text-default whitespace-normal`
}

export function dataTableThClass(dense = false) {
  const pad = dense ? DATA_TABLE_TH_PADDING_DENSE : DATA_TABLE_TH_PADDING
  return `${pad} text-xs font-medium text-muted`
}

export function dataTableTdClass(dense = false) {
  const pad = dense ? DATA_TABLE_TD_PADDING_DENSE : DATA_TABLE_TD_PADDING
  return `${pad} align-middle text-sm text-default`
}

export function dataTableSortableHeader<T>(
  column: Column<T, unknown>,
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  const isSorted = column.getIsSorted()
  const UIcon = resolveComponent('UIcon')
  const iconName = isSorted
    ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')
    : 'i-lucide-arrow-up-down'

  const button = h('button', {
    type: 'button',
    class: [
      'inline-flex items-center gap-1.5 text-xs font-medium text-muted',
      'hover:text-default transition-colors cursor-pointer',
      align === 'right' ? 'ms-auto' : align === 'center' ? 'mx-auto' : ''
    ],
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')
  }, [
    label,
    h(UIcon, {
      name: iconName,
      class: [
        'shrink-0 size-3.5',
        isSorted ? 'text-default' : 'text-muted opacity-70'
      ]
    })
  ])

  if (align === 'left') {
    return button
  }

  return h('div', {
    class: align === 'right' ? 'flex justify-end' : 'flex justify-center'
  }, [button])
}

export function dataTableStaticHeader(
  label: string,
  align: 'left' | 'right' | 'center' = 'left'
) {
  return h('span', {
    class: [
      'text-xs font-medium text-muted',
      align === 'right' ? 'block text-right' : align === 'center' ? 'block text-center' : ''
    ]
  }, label)
}
