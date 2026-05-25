<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { pb } = usePocketBase()
const scans = ref<Record<string, unknown>[]>([])

onMounted(async () => {
  scans.value = await pb.collection('scans').getFullList({ sort: '-created', expand: 'site' })
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Scan History">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UTable
        :data="scans"
        :columns="[
          { id: 'site', header: 'Site', cell: ({ row }) => (row.original.expand as any)?.site?.name || '' },
          { accessorKey: 'status', header: 'Status' },
          { accessorKey: 'pages_crawled', header: 'Pages' },
          { accessorKey: 'score_aa', header: 'AA Score' },
          { accessorKey: 'completed_at', header: 'Completed' }
        ]"
      >
        <template #status-cell="{ row }">
          <StatusBadge :status="row.original.status as string" :color="row.original.status === 'complete' ? 'success' : row.original.status === 'failed' ? 'error' : 'warning'" />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
