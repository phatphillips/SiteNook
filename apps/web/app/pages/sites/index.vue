<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Site } from '~/types/accessiq'

definePageMeta({ middleware: 'auth' })

const UCheckbox = resolveComponent('UCheckbox')

const { sites, fetchSites, createSite, deleteSites } = useSites()
const toast = useToast()
const table = useTemplateRef('table')

const showModal = ref(false)
const showDeleteModal = ref(false)
const form = reactive({ name: '', url: '', description: '' })
const loading = ref(false)
const deleting = ref(false)
const error = ref('')
const rowSelection = ref<Record<string, boolean>>({})

onMounted(() => fetchSites().catch(() => {}))

const selectedCount = computed(() =>
  table.value?.tableApi?.getFilteredSelectedRowModel().rows.length || 0
)

const columns: TableColumn<Site>[] = [
  {
    id: 'select',
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
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'crawl_schedule', header: 'Schedule' },
  { id: 'actions', header: '' }
]

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await createSite(form)
    showModal.value = false
    form.name = ''
    form.url = ''
    form.description = ''
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Could not create site.'
    error.value = msg.includes('Session expired') ? msg : msg.includes('Failed to create') ? 'Could not create site. Try signing in again.' : msg
  } finally {
    loading.value = false
  }
}

async function confirmDelete() {
  const rows = table.value?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = rows.map(row => row.original.id)
  if (!ids.length) return

  deleting.value = true
  try {
    await deleteSites(ids)
    rowSelection.value = {}
    showDeleteModal.value = false
    toast.add({
      title: 'Sites deleted',
      description: `Removed ${ids.length} site${ids.length === 1 ? '' : 's'}.`
    })
  } catch (e: unknown) {
    toast.add({
      title: 'Failed to delete sites',
      description: String(e),
      color: 'error'
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="sites">
    <template #header>
      <UDashboardNavbar title="Sites">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="selectedCount"
            color="error"
            variant="outline"
            icon="i-lucide-trash"
            @click="showDeleteModal = true"
          >
            Delete ({{ selectedCount }})
          </UButton>
          <UButton icon="i-lucide-plus" @click="showModal = true">Add Site</UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable
        ref="table"
        v-model:row-selection="rowSelection"
        :data="sites"
        :columns="columns"
      >
        <template #name-cell="{ row }">
          <NuxtLink :to="`/sites/${row.original.id}`" class="text-primary hover:underline">
            {{ row.original.name }}
          </NuxtLink>
        </template>
        <template #actions-cell="{ row }">
          <ScanTriggerButton
            :site-id="row.original.id"
            label="Scan"
            size="sm"
            variant="outline"
          />
        </template>
      </UTable>

      <p v-if="selectedCount" class="text-sm text-muted mt-3">
        {{ selectedCount }} of {{ sites.length }} site(s) selected.
      </p>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal" title="Add Site">
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Name" required>
          <UInput v-model="form.name" required />
        </UFormField>
        <UFormField label="URL" required>
          <UInput v-model="form.url" type="url" placeholder="https://example.com" required />
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="form.description" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
        <UButton type="submit" :loading="loading">Create Site</UButton>
      </form>
    </template>
  </UModal>

  <UModal
    v-model:open="showDeleteModal"
    :title="`Delete ${selectedCount} site${selectedCount === 1 ? '' : 's'}`"
    description="This will permanently remove the selected sites and all related scans and issues."
  >
    <template #body>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="subtle" @click="showDeleteModal = false" />
        <UButton label="Delete" color="error" :loading="deleting" @click="confirmDelete" />
      </div>
    </template>
  </UModal>
</template>
