<script setup lang="ts">
import type { DataTableSkeletonColumn } from '~/utils/dataTableSkeletonColumns'
import {
  DATA_TABLE_SKELETON_CLASS,
  dataTableTdClass,
  dataTableThClass
} from '~/utils/dataTableUi'

const props = withDefaults(
  defineProps<{
    rows?: number
    /** @deprecated Use `layout` instead. */
    columns?: number
    layout?: DataTableSkeletonColumn[]
    showHeader?: boolean
    dense?: boolean
  }>(),
  {
    rows: 8,
    columns: 6,
    layout: undefined,
    showHeader: true,
    dense: false
  }
)

const resolvedLayout = computed((): DataTableSkeletonColumn[] => {
  if (props.layout?.length) return props.layout
  return Array.from({ length: props.columns }, (_, index) => ({
    cellVariant: 'single' as const,
    align: index === props.columns - 1 ? 'right' as const : 'left' as const
  }))
})

const thClass = (column: DataTableSkeletonColumn) => [
  dataTableThClass(props.dense),
  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
  column.headerClass
]

const tdClass = (column: DataTableSkeletonColumn) => [
  dataTableTdClass(props.dense),
  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
  column.cellClass
]

function headerSkeletonClass(column: DataTableSkeletonColumn, index: number) {
  const last = index === resolvedLayout.value.length - 1
  if (column.align === 'right' || last) return `h-3 w-14 ms-auto ${DATA_TABLE_SKELETON_CLASS}`
  if (column.cellVariant === 'button') return `h-3 w-3 mx-auto ${DATA_TABLE_SKELETON_CLASS}`
  if (column.cellVariant === 'chip') return `h-3 w-8 ${DATA_TABLE_SKELETON_CLASS}`
  return `h-3 w-16 ${DATA_TABLE_SKELETON_CLASS}`
}

function singleSkeletonClass(column: DataTableSkeletonColumn) {
  const size = column.align === 'right' ? 'h-4 w-8 ms-auto' : 'h-4 w-12'
  return `${size} ${DATA_TABLE_SKELETON_CLASS}`
}
</script>

<template>
  <table
    class="data-table-skeleton w-full table-fixed border-collapse"
    aria-hidden="true"
  >
    <colgroup>
      <col
        v-for="(column, index) in resolvedLayout"
        :key="`col-${index}`"
        :style="column.width ? { width: column.width } : undefined"
      >
    </colgroup>
    <thead v-if="showHeader">
      <tr class="border-b border-default bg-elevated/20">
        <th
          v-for="(column, index) in resolvedLayout"
          :key="`head-${index}`"
          :class="thClass(column)"
        >
          <USkeleton :class="headerSkeletonClass(column, index)" />
        </th>
      </tr>
    </thead>
    <tbody class="divide-y divide-default">
      <tr
        v-for="row in rows"
        :key="`row-${row}`"
      >
        <td
          v-for="(column, index) in resolvedLayout"
          :key="`cell-${row}-${index}`"
          :class="tdClass(column)"
        >
          <div
            v-if="column.cellVariant === 'issue'"
            class="flex items-start gap-2 min-w-0"
          >
            <USkeleton :class="`h-2 w-2 rounded-full shrink-0 mt-1.5 ${DATA_TABLE_SKELETON_CLASS}`" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-center gap-2">
                <USkeleton :class="`h-[18px] w-[22px] rounded shrink-0 ${DATA_TABLE_SKELETON_CLASS}`" />
                <USkeleton :class="`h-3 w-24 max-w-full ${DATA_TABLE_SKELETON_CLASS}`" />
              </div>
              <USkeleton :class="`h-3.5 w-4/5 max-w-sm ${DATA_TABLE_SKELETON_CLASS}`" />
            </div>
          </div>
          <div
            v-else-if="column.cellVariant === 'double'"
            class="min-w-0 space-y-1.5 py-0.5"
          >
            <USkeleton :class="`h-3.5 w-3/5 max-w-xs ${DATA_TABLE_SKELETON_CLASS}`" />
            <USkeleton :class="`h-3 w-full max-w-md ${DATA_TABLE_SKELETON_CLASS}`" />
          </div>
          <USkeleton
            v-else-if="column.cellVariant === 'chip'"
            :class="`h-[18px] w-[22px] rounded ${DATA_TABLE_SKELETON_CLASS}`"
          />
          <USkeleton
            v-else-if="column.cellVariant === 'button'"
            :class="[
              `h-8 w-8 rounded-md ${DATA_TABLE_SKELETON_CLASS}`,
              column.align === 'right' ? 'ms-auto' : column.align === 'center' ? 'mx-auto' : ''
            ]"
          />
          <USkeleton
            v-else
            :class="singleSkeletonClass(column)"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>
