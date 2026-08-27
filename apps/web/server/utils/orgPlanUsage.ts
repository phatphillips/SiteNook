import type PocketBase from 'pocketbase'
import type { Site } from '~/types/sitenook'
import type { OrganizationPlanUsage } from '~/utils/planEligibility'
import { parseScanConfig } from '~/utils/scanConfig'
import { parseSiteSettings } from '~/utils/siteSettings'
import { pbRelation } from '~/utils/pbFilter'

function resolveOwnerId(owner: unknown): string | null {
  if (typeof owner === 'string') return owner
  if (owner && typeof owner === 'object' && 'id' in owner) {
    return String((owner as { id: string }).id)
  }
  return null
}

function siteHasScheduledCrawl(site: Site): boolean {
  if (site.crawl_schedule && site.crawl_schedule !== 'manual') {
    return true
  }
  const raw = site.default_scan_config
  if (!raw) return false
  try {
    const config = parseScanConfig(raw)
    return config.scheduleEnabled
  } catch {
    return false
  }
}

function siteHasSeoEnabled(site: Site): boolean {
  const settings = parseSiteSettings(site.site_settings)
  return settings.checkSeo
}

export async function loadOrganizationPlanUsage(
  pb: PocketBase,
  organizationId: string
): Promise<OrganizationPlanUsage> {
  const members = await pb.collection('users').getFullList({
    filter: pbRelation('organization', organizationId)
  })
  const memberIds = new Set(members.map(member => member.id))

  const allSites = await pb.collection('sites').getFullList() as unknown as Site[]
  const orgSites = allSites.filter((site) => {
    const ownerId = resolveOwnerId(site.owner)
    return ownerId ? memberIds.has(ownerId) : false
  })

  const siteIds = orgSites.map(site => site.id)
  let policyCount = 0
  if (siteIds.length) {
    const policies = await pb.collection('policies').getFullList({
      filter: siteIds.map(id => pbRelation('site', id)).join(' || ')
    })
    policyCount = policies.length
  }

  return {
    siteCount: orgSites.length,
    teamMemberCount: members.length,
    scheduledSiteCount: orgSites.filter(siteHasScheduledCrawl).length,
    policyCount,
    seoEnabledSiteCount: orgSites.filter(siteHasSeoEnabled).length
  }
}
