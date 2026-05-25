import type { Site } from '~/types/accessiq'

export function useSites() {
  const { pb, requireUser } = usePocketBase()
  const sites = ref<Site[]>([])
  const activeSiteId = useState<string | null>('active-site-id', () => null)
  const loading = ref(false)

  const activeSite = computed(() => sites.value.find(s => s.id === activeSiteId.value) || sites.value[0] || null)

  async function fetchSites() {
    requireUser()
    loading.value = true
    try {
      sites.value = await pb.collection('sites').getFullList({ sort: 'name' }) as unknown as Site[]
      if (!activeSiteId.value && sites.value.length) {
        activeSiteId.value = sites.value[0].id
      }
    } finally {
      loading.value = false
    }
  }

  async function createSite(data: { name: string, url: string, description?: string }) {
    const currentUser = requireUser()
    const record = await pb.collection('sites').create({
      ...data,
      owner: currentUser.id,
      crawl_schedule: 'manual'
    })
    await fetchSites()
    activeSiteId.value = record.id
    return record
  }

  async function queueScanWithConfig(
    siteId: string,
    rawConfig: Record<string, unknown>,
    scanType: string
  ) {
    const currentUser = requireUser()

    await pb.collection('scan_queue').create({
      site: siteId,
      scan_type: scanType,
      priority: 0,
      requested_by: currentUser.id,
      status: 'pending',
      raw_config: rawConfig
    })
  }

  async function saveDefaultScanConfig(siteId: string, rawConfig: Record<string, unknown>) {
    requireUser()
    await pb.collection('sites').update(siteId, {
      default_scan_config: rawConfig
    })
    await fetchSites()
  }

  async function saveSiteSchedule(
    siteId: string,
    crawlSchedule: string,
    rawConfig: Record<string, unknown>
  ) {
    requireUser()
    await pb.collection('sites').update(siteId, {
      crawl_schedule: crawlSchedule,
      default_scan_config: rawConfig
    })
    await fetchSites()
  }

  /** @deprecated Use ScanConfigModal + queueScanWithConfig */
  async function triggerScan(siteId?: string, scanType = 'full', targetUrl?: string) {
    const id = siteId || activeSiteId.value
    if (!id) throw new Error('No site selected')

    const rawConfig: Record<string, unknown> = {
      mode: targetUrl ? 'pages' : 'full',
      pages: targetUrl ? [targetUrl] : []
    }

    await queueScanWithConfig(id, rawConfig, scanType)
  }

  async function deleteSites(siteIds: string[]) {
    requireUser()
    if (!siteIds.length) return

    await Promise.all(siteIds.map(id => pb.collection('sites').delete(id)))

    if (activeSiteId.value && siteIds.includes(activeSiteId.value)) {
      activeSiteId.value = null
    }

    await fetchSites()
  }

  return {
    sites,
    activeSite,
    activeSiteId,
    loading,
    fetchSites,
    createSite,
    deleteSites,
    triggerScan,
    queueScanWithConfig,
    saveDefaultScanConfig,
    saveSiteSchedule
  }
}
