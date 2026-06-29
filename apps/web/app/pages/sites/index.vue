<script setup lang="ts">
import type { Site } from '~/types/accessiq'

definePageMeta({ middleware: 'auth' })

const { sessionUser, awaitAuthReady } = usePocketBase()
const { sites, fetchSites, createSite, deleteSites } = useSites()
const canWrite = computed(() => canWriteOrg(sessionUser.value))
const toast = useToast()

type SitesTableExpose = {
  selectedCount: number
  table: { tableApi?: { getFilteredSelectedRowModel: () => { rows: Array<{ original: Site }> } } } | null
  clearSelection?: () => void
}

const sitesTable = useTemplateRef<SitesTableExpose | null>('sitesTable')

const showAddModal = ref(false)
const showDeleteModal = ref(false)
const settingsSite = ref<Site | null>(null)
const showSettingsModal = ref(false)
const form = reactive({ name: '', url: '', description: '' })
const loading = ref(false)
const deleting = ref(false)
const error = ref('')

onMounted(async () => {
  await awaitAuthReady()
  fetchSites().catch(() => {})
})

const selectedCount = computed(() => sitesTable.value?.selectedCount ?? 0)

async function submitCreate() {
  loading.value = true
  error.value = ''
  try {
    await createSite(form)
    showAddModal.value = false
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

async function openSettings(site: Site) {
  settingsSite.value = site
  await nextTick()
  showSettingsModal.value = true
}

async function onSettingsSaved() {
  await fetchSites()
  if (settingsSite.value) {
    settingsSite.value = sites.value.find(s => s.id === settingsSite.value!.id) ?? settingsSite.value
  }
}

async function confirmDelete() {
  const table = sitesTable.value?.table
  const rows = table?.tableApi?.getFilteredSelectedRowModel().rows || []
  const ids = rows.map(row => row.original.id)
  if (!ids.length) return

  deleting.value = true
  try {
    await deleteSites(ids)
    sitesTable.value?.clearSelection?.()
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
  <AppDashboardPanel id="sites">
    <template #header>
      <DashboardPageNavbar title="Sites">
        <template v-if="canWrite" #right>
          <UButton
            v-if="selectedCount"
            color="error"
            variant="outline"
            icon="i-lucide-trash"
            @click="showDeleteModal = true"
          >
            Delete ({{ selectedCount }})
          </UButton>
          <UButton icon="i-lucide-plus" @click="showAddModal = true">Add Site</UButton>
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <SitesTable ref="sitesTable" :sites="sites" :can-write="canWrite" @edit="openSettings" />
    </template>
  </AppDashboardPanel>

  <SiteSettingsModal
    v-model:open="showSettingsModal"
    :site="settingsSite"
    @saved="onSettingsSaved"
    @deleted="fetchSites"
  />

  <UModal v-model:open="showAddModal" title="Add Site">
    <template #body>
      <form class="space-y-4" @submit.prevent="submitCreate">
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
