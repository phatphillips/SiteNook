<script setup lang="ts">
const props = withDefaults(defineProps<{
  siteId?: string
  pageUrl?: string
  scanType?: string
  label?: string
  queuedLabel?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
}>(), {
  scanType: 'full',
  label: 'Scan Now',
  queuedLabel: 'Queued…',
  size: 'md',
  variant: 'solid'
})

const route = useRoute()
const { pb } = usePocketBase()
const { sites, activeSiteId, fetchSites } = useSites()

const showConfigModal = ref(false)
const loadedSite = ref<import('~/types/accessiq').Site | null>(null)

const resolvedSiteId = computed(() =>
  props.siteId || (route.params.id as string | undefined) || activeSiteId.value
)

const site = computed(() =>
  sites.value.find(s => s.id === resolvedSiteId.value) || loadedSite.value
)

const { isQueued, refresh } = useScanQueueStatus(resolvedSiteId)

const buttonLabel = computed(() =>
  isQueued.value ? props.queuedLabel : props.label
)

async function openModal() {
  if (!resolvedSiteId.value) {
    useToast().add({
      title: 'No site selected',
      description: 'Select a site before scanning.',
      color: 'warning'
    })
    return
  }

  if (!site.value) {
    try {
      if (!sites.value.length) await fetchSites()
      loadedSite.value = await pb.collection('sites').getOne(resolvedSiteId.value) as import('~/types/accessiq').Site
    } catch {
      useToast().add({ title: 'Site not found', color: 'error' })
      return
    }
  }

  showConfigModal.value = true
}

async function onQueued() {
  await refresh()
}
</script>

<template>
  <div class="inline-flex">
    <UButton
      color="primary"
      icon="i-lucide-radar"
      :label="buttonLabel"
      :size="size"
      :variant="variant"
      :loading="isQueued"
      :disabled="isQueued"
      @click="openModal"
    />
    <ScanConfigModal
      v-model:open="showConfigModal"
      :site="site"
      :initial-page-url="pageUrl"
      @queued="onQueued"
    />
  </div>
</template>
