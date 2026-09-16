/**
 * Plan limit enforcement — keep in sync with apps/web/app/utils/planLimits.ts
 */

function hasSuperuserAuth(e) {
  try {
    return e.hasSuperuserAuth()
  } catch (_) {
    return false
  }
}

function normalizeOrgId(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.id) return String(value.id)
  return String(value)
}

function normalizePlan(plan) {
  const raw = String(plan || 'free').trim().toLowerCase()
  if (raw === 'standard') return 'team'
  if (raw === 'free' || raw === 'starter' || raw === 'team' || raw === 'business' || raw === 'enterprise') {
    return raw
  }
  return 'free'
}

/** @type {Record<string, { maxSites: number, maxTeamMembers: number, scanHistoryDays: number, scheduledScans: boolean, policies: boolean }>} */
const PLAN_LIMITS = {
  free: { maxSites: 1, maxTeamMembers: 2, scanHistoryDays: 7, scheduledScans: false, policies: false },
  starter: { maxSites: 3, maxTeamMembers: 2, scanHistoryDays: 7, scheduledScans: false, policies: false },
  team: { maxSites: 10, maxTeamMembers: 10, scanHistoryDays: 30, scheduledScans: true, policies: false },
  business: { maxSites: 25, maxTeamMembers: 50, scanHistoryDays: 90, scheduledScans: true, policies: true },
  enterprise: { maxSites: 999999, maxTeamMembers: 999999, scanHistoryDays: 365, scheduledScans: true, policies: true }
}

function isCommercialEnabled() {
  const raw = String($os.getenv('SITENOOK_COMMERCIAL') || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

function getLimitsForOrg(app, orgId) {
  if (!isCommercialEnabled()) {
    return PLAN_LIMITS.enterprise
  }
  const id = normalizeOrgId(orgId)
  if (!id) return PLAN_LIMITS.free
  try {
    const org = app.findRecordById('organizations', id)
    return PLAN_LIMITS[normalizePlan(org.get('plan'))] || PLAN_LIMITS.free
  } catch (_) {
    return PLAN_LIMITS.free
  }
}

function countRecords(app, collection, filter) {
  let total = 0
  let page = 1
  const perPage = 200
  while (true) {
    const result = app.findRecordsByFilter(collection, filter, '', perPage, (page - 1) * perPage, {})
    if (!result.length) break
    total += result.length
    if (result.length < perPage) break
    page += 1
  }
  return total
}

function countOrgSitesSimple(app, orgId, excludeSiteId) {
  const id = normalizeOrgId(orgId)
  if (!id) return 0
  let filter = 'organization = "' + id + '"'
  if (excludeSiteId) filter += ' && id != "' + excludeSiteId + '"'
  return countRecords(app, 'sites', filter)
}

function countOrgUsers(app, orgId, excludeUserId) {
  const id = normalizeOrgId(orgId)
  if (!id) return 0
  let filter = 'organization = "' + id + '"'
  if (excludeUserId) filter += ' && id != "' + excludeUserId + '"'
  return countRecords(app, 'users', filter)
}

function isScheduledCrawl(schedule) {
  const value = String(schedule || '').trim()
  return value !== '' && value !== 'manual'
}

function enforceSiteCreateLimit(e) {
  const orgId = normalizeOrgId(e.record.get('organization'))
  if (!orgId) return
  const limits = getLimitsForOrg(e.app, orgId)
  const count = countOrgSitesSimple(e.app, orgId, '')
  if (count >= limits.maxSites) {
    throw new BadRequestError(
      'Site limit reached for your plan (' + limits.maxSites + '). Upgrade to add more sites.'
    )
  }
}

function enforceSiteUpdateLimits(e) {
  const record = e.record
  const original = record.original()
  const orgId = normalizeOrgId(record.get('organization'))
  if (!orgId) return

  const limits = getLimitsForOrg(e.app, orgId)
  const newSchedule = record.get('crawl_schedule')
  const oldSchedule = original.get('crawl_schedule')
  if (isScheduledCrawl(newSchedule) && !isScheduledCrawl(oldSchedule) && !limits.scheduledScans) {
    throw new BadRequestError('Scheduled scans are available on Team plans and above.')
  }
}

function enforceUserCreateLimit(e) {
  const orgId = normalizeOrgId(e.record.get('organization'))
  if (!orgId) return
  const limits = getLimitsForOrg(e.app, orgId)
  const count = countOrgUsers(e.app, orgId, '')
  if (count >= limits.maxTeamMembers) {
    throw new BadRequestError(
      'Team member limit reached for your plan (' + limits.maxTeamMembers + '). Upgrade to invite more.'
    )
  }
}

function enforcePolicyCreateLimit(e) {
  let orgId = normalizeOrgId(e.record.get('organization'))
  if (!orgId) {
    const siteId = normalizeOrgId(e.record.get('site'))
    if (!siteId) return
    try {
      const site = e.app.findRecordById('sites', siteId)
      orgId = normalizeOrgId(site.get('organization'))
    } catch (_) {
      return
    }
  }
  if (!orgId) return
  const limits = getLimitsForOrg(e.app, orgId)
  if (!limits.policies) {
    throw new BadRequestError('Custom content policies are available on Business plans and above.')
  }
}

function enforceOrganizationUpdateLock(e) {
  if (!isCommercialEnabled()) return
  const record = e.record
  const original = record.original()
  const lockedFields = [
    'plan',
    'stripe_customer_id',
    'stripe_subscription_id',
    'subscription_status',
    'trial_ends_at',
    'trial_nudge_stage',
    'status',
    'closed_at',
    'purge_scheduled_at',
    'closed_by',
    'created_via'
  ]
  for (let i = 0; i < lockedFields.length; i++) {
    const field = lockedFields[i]
    const next = record.get(field)
    const prev = original.get(field)
    if (String(next ?? '') !== String(prev ?? '')) {
      throw new BadRequestError('Organization billing fields cannot be changed directly.')
    }
  }
}

module.exports = {
  hasSuperuserAuth,
  normalizeOrgId,
  normalizePlan,
  PLAN_LIMITS,
  getLimitsForOrg,
  enforceSiteCreateLimit,
  enforceSiteUpdateLimits,
  enforceUserCreateLimit,
  enforcePolicyCreateLimit,
  enforceOrganizationUpdateLock,
  isScheduledCrawl
}
