import { createSharedComposable } from '@vueuse/core'
import type { Site } from '~/types/accessiq'
import { requireUserOrganizationId } from '~/utils/orgAccess'
import { buildDefaultSiteScanConfig, buildDefaultSiteSettingsRecord } from '~/utils/defaultSiteScan'
import {
  deriveScanType,
  getBrowserTimezone,
  mergeScanConfigRaw,
  parseScanConfig,
  serializeScanConfig
} from '~/utils/scanConfig'
import {
  computeScheduleNextRunAt,
  computeScheduleNextRunAfterManualFullScan,
  getScheduleTimeFromConfig,
  getScheduleTimezoneFromConfig
} from '~/utils/scheduleNextRun'
import {
  describePlanLimitExceeded,
  getPlanLimits,
  normalizeOrganizationPlan,
  planHasFeature
} from '~/utils/planLimits'
import { queuePriorityForPlan } from '~/utils/planQueuePriority'

function _useSites() {
  const { pb, requireUser, awaitAuthReady, syncAuth } = usePocketBase()
  const { organization } = useTenantOrg()
  const sites = ref<Site[]>([])
  const activeSiteId = useState<string | null>('active-site-id', () => null)
  const loading = ref(false)

  const activeSite = computed(() => sites.value.find(s => s.id === activeSiteId.value) || sites.value[0] || null)

  function patchSiteInList(record: Site) {
    const idx = sites.value.findIndex(s => s.id === record.id)
    if (idx >= 0) {
      sites.value[idx] = { ...sites.value[idx], ...record }
    } else {
      sites.value = [...sites.value, record].sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  function assertSiteSettingsPersisted(record: Site) {
    const saved = record.site_settings
    if (!saved || typeof saved !== 'object' || !Object.keys(saved).length) {
      throw new Error(
        'Site settings were not saved. Rebuild or restart PocketBase so the site_settings schema patch can run.'
      )
    }
  }

  async function refreshSite(siteId: string): Promise<Site> {
    requireUser()
    const record = await pb.collection('sites').getOne(siteId) as unknown as Site
    patchSiteInList(record)
    return record
  }

  function mergeFetchedSites(fetched: Site[]): Site[] {
    const previousById = new Map(sites.value.map(site => [site.id, site]))
    return fetched.map((site) => {
      const previous = previousById.get(site.id)
      const fetchedSettings = site.site_settings
      const hasFetchedSettings = !!fetchedSettings
        && typeof fetchedSettings === 'object'
        && Object.keys(fetchedSettings).length > 0
      if (hasFetchedSettings || !previous?.site_settings) return site
      return { ...site, site_settings: previous.site_settings }
    })
  }

  async function fetchSites() {
    await awaitAuthReady()
    syncAuth()
    requireUser()
    loading.value = true
    try {
      const fetched = await pb.collection('sites').getFullList({ sort: 'name' }) as unknown as Site[]
      sites.value = mergeFetchedSites(fetched)
      if (!activeSiteId.value && sites.value.length) {
        activeSiteId.value = sites.value[0]!.id
      }
    } finally {
      loading.value = false
    }
  }

  function currentOrgPlan() {
    return normalizeOrganizationPlan(organization.value?.plan)
  }

  async function createSite(data: { name: string, url: string, description?: string }) {
    const currentUser = requireUser()
    const organizationId = requireUserOrganizationId(currentUser)
    const plan = currentOrgPlan()
    const limits = getPlanLimits(plan)
    if (sites.value.length >= limits.maxSites) {
      throw new Error(describePlanLimitExceeded('sites', plan))
    }

    const timeZone = getBrowserTimezone()
    const defaultScanConfig = buildDefaultSiteScanConfig(data.url, timeZone)
    const now = new Date()
    const crawlSchedule = limits.scheduledScans ? 'daily' : 'manual'
    const scheduleNextRunAt = limits.scheduledScans
      ? computeScheduleNextRunAt('daily', {
          scheduleTime: '14:00',
          from: now,
          now,
          timeZone
        })
      : null
    const record = await pb.collection('sites').create({
      ...data,
      organization: organizationId,
      owner: currentUser.id,
      crawl_schedule: crawlSchedule,
      default_scan_config: defaultScanConfig,
      site_settings: buildDefaultSiteSettingsRecord(),
      schedule_next_run_at: scheduleNextRunAt,
      schedule_last_enqueued_at: null
    })
    await pb.collection('site_access').create({
      user: currentUser.id,
      site: record.id,
      role: 'owner'
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
      priority: queuePriorityForPlan(organization.value?.plan),
      requested_by: currentUser.id,
      status: 'pending',
      raw_config: rawConfig
    })

    if (scanType === 'full') {
      const site = sites.value.find(s => s.id === siteId)
      if (site?.crawl_schedule && site.crawl_schedule !== 'manual') {
        const now = new Date()
        const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
        const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config, getBrowserTimezone())
        const scheduleNextRunAt = computeScheduleNextRunAfterManualFullScan(site.crawl_schedule, {
          scheduleTime,
          now,
          timeZone
        })
        if (scheduleNextRunAt) {
          await pb.collection('sites').update(siteId, { schedule_next_run_at: scheduleNextRunAt })
          site.schedule_next_run_at = scheduleNextRunAt
        }
      }
    }
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
    const plan = currentOrgPlan()
    if (crawlSchedule !== 'manual' && !planHasFeature(plan, 'scheduledScans')) {
      throw new Error(describePlanLimitExceeded('scheduledScans', plan))
    }
    const now = new Date()
    const scheduleTime = getScheduleTimeFromConfig(rawConfig)
    const timeZone = getScheduleTimezoneFromConfig(rawConfig, getBrowserTimezone())
    const scheduleNextRunAt = computeScheduleNextRunAt(crawlSchedule, {
      scheduleTime,
      from: now,
      now,
      timeZone
    })
    await pb.collection('sites').update(siteId, {
      crawl_schedule: crawlSchedule,
      default_scan_config: rawConfig,
      schedule_next_run_at: scheduleNextRunAt,
      schedule_last_enqueued_at: null
    })
    await fetchSites()
  }

  async function clearSiteSchedule(siteId: string) {
    requireUser()
    await pb.collection('sites').update(siteId, {
      crawl_schedule: 'manual',
      schedule_next_run_at: null,
      schedule_last_enqueued_at: null
    })
    await fetchSites()
  }

  /** @deprecated Use ScanConfigModal + queueScanWithConfig */
  async function triggerScan(siteId?: string, scanType = 'full', targetUrl?: string) {
    const id = siteId || activeSiteId.value
    if (!id) throw new Error('No site selected')

    const site = sites.value.find(s => s.id === id)
    const override: Record<string, unknown> = {
      mode: targetUrl ? 'pages' : 'full',
      pages: targetUrl ? [targetUrl] : []
    }
    const merged = mergeScanConfigRaw(site?.default_scan_config, override)
    const parsed = parseScanConfig(merged, site?.url)
    await queueScanWithConfig(id, serializeScanConfig(parsed), deriveScanType(parsed))
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

  async function updateSite(
    siteId: string,
    data: {
      name?: string
      url?: string
      description?: string
      site_settings?: Record<string, unknown>
    }
  ) {
    requireUser()
    const payload = { ...data }
    if (payload.site_settings) {
      payload.site_settings = { ...payload.site_settings }
    }
    const record = await pb.collection('sites').update(siteId, payload) as unknown as Site
    if (payload.site_settings) {
      assertSiteSettingsPersisted(record)
    }
    patchSiteInList(record)
    await fetchSites()
  }

  async function saveSiteSettings(siteId: string, settings: Record<string, unknown>) {
    requireUser()
    const payload = { ...settings }
    const record = await pb.collection('sites').update(siteId, { site_settings: payload }) as unknown as Site
    assertSiteSettingsPersisted(record)
    patchSiteInList(record)
    await fetchSites()
    const token = pb.authStore.token
    if (token) {
      const { reconcileSiteA11ySummary } = await import('~/utils/a11yReconcile')
      await reconcileSiteA11ySummary(siteId, token).catch(() => {})
    }
  }

  async function queueDefaultScan(siteId: string) {
    const site = sites.value.find(s => s.id === siteId)
    if (!site) throw new Error('Site not found')
    // Empty override — worker merges site.default_scan_config at claim time.
    await queueScanWithConfig(siteId, {}, deriveScanType(parseScanConfig(site.default_scan_config, site.url)))
  }

  function resetSession() {
    sites.value = []
    activeSiteId.value = null
    loading.value = false
  }

  return {
    sites,
    activeSite,
    activeSiteId,
    loading,
    resetSession,
    fetchSites,
    refreshSite,
    createSite,
    updateSite,
    saveSiteSettings,
    deleteSites,
    triggerScan,
    queueScanWithConfig,
    queueDefaultScan,
    saveDefaultScanConfig,
    saveSiteSchedule,
    clearSiteSchedule
  }
}

export const useSites = createSharedComposable(_useSites)
