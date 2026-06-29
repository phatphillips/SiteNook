<script setup lang="ts">
const props = withDefaults(defineProps<{
  siteId?: string
  pageUrl?: string
  scanType?: string
  label?: string
  queuedLabel?: string
  busyLabel?: string
  icon?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  /** Icon-only control (e.g. per-row scan in By Page table). */
  iconOnly?: boolean
}>(), {
  scanType: 'full',
  label: 'Scan Now',
  queuedLabel: 'Queued…',
  busyLabel: 'Scanning…',
  icon: 'i-lucide-radar',
  size: 'md',
  variant: 'solid',
  iconOnly: false
})

const route = useRoute()
const { pb, sessionUser } = usePocketBase()
const { sites, activeSiteId, fetchSites } = useSites()
const canWrite = computed(() => canWriteOrg(sessionUser.value))

const emit = defineEmits<{
  queued: []
}>()

const showConfigModal = ref(false)
const loadedSite = ref<import('~/types/accessiq').Site | null>(null)

const resolvedSiteId = computed(() =>
  props.siteId || (route.params.id as string | undefined) || activeSiteId.value
)
const queueSiteId = computed<string | undefined>(() => resolvedSiteId.value ?? undefined)

const site = computed(() =>
  sites.value.find(s => s.id === resolvedSiteId.value) || loadedSite.value
)

const { isQueued, isRunning, isBusy, refresh } = useScanQueueStatus(queueSiteId)

const buttonLabel = computed(() =>
  isQueued.value ? props.queuedLabel : (isRunning.value ? props.busyLabel : props.label)
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

  if (!pb) {
    useToast().add({ title: 'Not ready', description: 'Try again in a moment.', color: 'warning' })
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
  emit('queued')
}
</script>

<template>
  <div v-if="canWrite" class="inline-flex">
    <UButton
      :color="iconOnly ? 'neutral' : variant === 'ghost' ? 'neutral' : 'primary'"
      :icon="icon"
      :label="iconOnly ? undefined : buttonLabel"
      :aria-label="iconOnly ? (isBusy ? buttonLabel : label) : undefined"
      :size="size"
      :variant="variant"
      :square="iconOnly"
      :loading="isBusy"
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
