import { createSharedComposable } from '@vueuse/core'
import type { Site } from '~/types/sitenook'
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
  computeScheduleNextRunAfterManualFullScan,
  computeScheduleNextRunWithMinGap,
  CRAWL_SCHEDULE_AUTO,
  getScheduleTimeFromConfig,
  getScheduleTimezoneFromConfig
} from '~/utils/scheduleNextRun'
import {
  describePlanLimitExceeded,
  getPlanLimits,
  normalizeOrganizationPlan
} from '~/utils/planLimits'
import { queuePriorityForPlan } from '~/utils/planQueuePriority'
import { isCommercialEnabled } from '~/utils/commercial'

export const ALL_SITES = '__all__' as const

function _useSites() {
  const { pb, requireUser, awaitAuthReady, syncAuth } = usePocketBase()
  const { organization } = useTenantOrg()
  const sites = ref<Site[]>([])
  const workspaceSiteId = useState<string>('workspace-site-id', () => ALL_SITES)
  const loading = ref(false)

  const isAllSites = computed(() => workspaceSiteId.value === ALL_SITES)

  const activeSiteId = computed({
    get(): string | null {
      return isAllSites.value ? null : workspaceSiteId.value
    },
    set(value: string | null) {
      workspaceSiteId.value = value ?? ALL_SITES
    }
  })

  const activeSite = computed(() => {
    if (isAllSites.value) return null
    return sites.value.find(s => s.id === workspaceSiteId.value) || sites.value[0] || null
  })

  function selectAllSites() {
    workspaceSiteId.value = ALL_SITES
  }

  function selectSite(siteId: string) {
    workspaceSiteId.value = siteId
  }

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
    try {
      requireUser()
    } catch {
      return
    }
    loading.value = true
    try {
      const fetched = await pb.collection('sites').getFullList({ sort: 'name' }) as unknown as Site[]
      sites.value = mergeFetchedSites(fetched)

      if (isAllSites.value) {
        return
      }

      const selectedExists = sites.value.some(site => site.id === workspaceSiteId.value)
      if (!selectedExists) {
        workspaceSiteId.value = sites.value[0]?.id ?? ALL_SITES
      }
    } finally {
      loading.value = false
    }
  }

  function currentOrgPlan() {
    if (!isCommercialEnabled()) return 'enterprise' as const
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
    const record = await pb.collection('sites').create({
      ...data,
      organization: organizationId,
      owner: currentUser.id,
      crawl_schedule: CRAWL_SCHEDULE_AUTO,
      default_scan_config: defaultScanConfig,
      site_settings: buildDefaultSiteSettingsRecord(),
      schedule_next_run_at: null,
      schedule_last_enqueued_at: null
    })
    await pb.collection('site_access').create({
      user: currentUser.id,
      site: record.id,
      role: 'owner'
    })
    await fetchSites()
    selectSite(record.id)

    if (CRAWL_SCHEDULE_AUTO && CRAWL_SCHEDULE_AUTO !== 'manual') {
      const { markScheduleEnabled, onboardingState } = useOnboarding()
      if (!onboardingState.value.scheduleEnabled) {
        await markScheduleEnabled().catch(() => {})
      }
    }

    return record
  }

  async function createSiteAndQueueScan(
    data: { name: string, url: string, description?: string },
    rawConfig: Record<string, unknown>,
    scanType: string
  ) {
    const record = await createSite(data)
    await pb.collection('sites').update(record.id, {
      default_scan_config: rawConfig
    })
    await queueScanWithConfig(record.id, rawConfig, scanType)
    await fetchSites()
    return record
  }

  async function bumpScheduleAfterFullScan(siteId: string) {
    const site = sites.value.find(s => s.id === siteId)
    if (!site?.crawl_schedule || site.crawl_schedule === 'manual') return

    const now = new Date()
    const scheduleTime = getScheduleTimeFromConfig(site.default_scan_config)
    const timeZone = getScheduleTimezoneFromConfig(site.default_scan_config, getBrowserTimezone())
    const scheduleNextRunAt = computeScheduleNextRunWithMinGap(
      site.crawl_schedule,
      {
        scheduleTime,
        from: now,
        now,
        timeZone
      },
      now
    ) ?? computeScheduleNextRunAfterManualFullScan(site.crawl_schedule, {
      scheduleTime,
      now,
      timeZone
    })
    if (scheduleNextRunAt) {
      await pb.collection('sites').update(siteId, { schedule_next_run_at: scheduleNextRunAt })
      site.schedule_next_run_at = scheduleNextRunAt
    }
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
      await bumpScheduleAfterFullScan(siteId)
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
    const now = new Date()
    const scheduleTime = getScheduleTimeFromConfig(rawConfig)
    const timeZone = getScheduleTimezoneFromConfig(rawConfig, getBrowserTimezone())
    const scheduleNextRunAt = computeScheduleNextRunWithMinGap(
      crawlSchedule,
      { scheduleTime, from: now, now, timeZone },
      now
    )
    await pb.collection('sites').update(siteId, {
      crawl_schedule: crawlSchedule,
      default_scan_config: rawConfig,
      schedule_next_run_at: scheduleNextRunAt,
      schedule_last_enqueued_at: null
    })
    await fetchSites()

    if (crawlSchedule && crawlSchedule !== 'manual') {
      const { markScheduleEnabled, onboardingState } = useOnboarding()
      if (!onboardingState.value.scheduleEnabled) {
        await markScheduleEnabled().catch(() => {})
      }
    }
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
  async function triggerScan(siteId?: string, _scanType = 'full', targetUrl?: string) {
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

    if (!isAllSites.value && activeSiteId.value && siteIds.includes(activeSiteId.value)) {
      selectAllSites()
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
    // Empty override. Worker merges site.default_scan_config at claim time.
    await queueScanWithConfig(siteId, {}, deriveScanType(parseScanConfig(site.default_scan_config, site.url)))
  }

  function resetSession() {
    sites.value = []
    workspaceSiteId.value = ALL_SITES
    loading.value = false
  }

  return {
    ALL_SITES,
    sites,
    activeSite,
    activeSiteId,
    isAllSites,
    loading,
    resetSession,
    selectAllSites,
    selectSite,
    fetchSites,
    refreshSite,
    createSite,
    createSiteAndQueueScan,
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
