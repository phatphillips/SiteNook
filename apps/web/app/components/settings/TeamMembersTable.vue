<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { Row } from '@tanstack/vue-table'
import type { TableColumn } from '@nuxt/ui'
import type { TeamMember } from '~/composables/useTeamMembers'
import {
  formatOrgUserRole
} from '~/utils/orgAccess'

const props = defineProps<{
  members: TeamMember[]
  loading?: boolean
  canManage?: boolean
  currentUserId?: string
}>()

const emit = defineEmits<{
  'open-member': [member: TeamMember]
}>()

const UCheckbox = resolveComponent('UCheckbox')
const UBadge = resolveComponent('UBadge')

const table = useTemplateRef('table')
const rowSelection = ref<Record<string, boolean>>({})

function roleBadgeColor(role: string) {
  if (role === 'admin') return 'primary'
  return 'neutral'
}

function onRowSelect(_e: Event, row: Row<TeamMember>) {
  if (!props.canManage) return
  emit('open-member', row.original)
}

const columns = computed<TableColumn<TeamMember>[]>(() => {
  const base: TableColumn<TeamMember>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      enableHiding: false,
      cell: ({ row }) => {
        const isSelf = row.original.id === props.currentUserId
        return h('div', { class: 'flex items-center gap-2 min-w-0' }, [
          h('span', { class: 'font-medium text-highlighted truncate' }, row.original.name),
          isSelf ? h(UBadge, { color: 'neutral', variant: 'subtle', size: 'sm' }, () => 'You') : null,
          !row.original.verified
            ? h(UBadge, { color: 'warning', variant: 'subtle', size: 'sm' }, () => 'Pending')
            : null
        ])
      }
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) =>
        h('div', { class: 'flex items-center gap-2' }, [
          h(UBadge, {
            color: roleBadgeColor(String(row.original.role)),
            variant: 'subtle'
          }, () => formatOrgUserRole(row.original.role)),
          row.original.is_billing_contact
            ? h(UBadge, { color: 'info', variant: 'subtle', size: 'sm' }, () => 'Billing')
            : null
        ])
    }
  ]

  if (!props.canManage) {
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
          'ariaLabel': 'Select all team members'
        }),
      cell: ({ row }) =>
        h('div', {
          class: 'flex items-center',
          onClick: (e: Event) => e.stopPropagation()
        }, [
          h(UCheckbox, {
            'modelValue': row.getIsSelected(),
            'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
            'ariaLabel': `Select ${row.original.name}`
          })
        ])
    },
    ...base
  ]
})

const selectedCount = computed(() =>
  table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
)

function getSelectedMembers(): TeamMember[] {
  const rows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  return rows.map(row => row.original)
}

defineExpose({
  selectedCount,
  table,
  getSelectedMembers,
  clearSelection() {
    rowSelection.value = {}
  }
})
</script>

<template>
  <div class="table-surface">
    <UTable
      ref="table"
      v-model:row-selection="rowSelection"
      :data="members"
      :columns="columns"
      :loading="loading"
      :empty="loading ? 'Loading team members…' : 'No team members found.'"
      :get-row-id="(row: TeamMember) => row.id"
      :on-select="canManage ? onRowSelect : undefined"
      :ui="{
        root: 'relative w-full',
        tr: canManage ? 'cursor-pointer hover:bg-elevated/40 data-[selected=true]:bg-elevated/30' : undefined
      }"
    />
  </div>
</template>
