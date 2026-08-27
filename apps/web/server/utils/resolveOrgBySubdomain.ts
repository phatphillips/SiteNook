import { createError, type H3Event } from 'h3'
import type { TenantOrgPublic } from '~/types/tenant'
import { clearPbAdminCache, getPbAdmin } from './pbAdmin'

export async function resolveOrgBySubdomain(
  subdomain: string,
  event: H3Event
): Promise<TenantOrgPublic | null> {
  const slug = subdomain.trim().toLowerCase()
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null

  async function lookup(forceAuth = false) {
    if (forceAuth) clearPbAdminCache()
    const pb = await getPbAdmin(event)
    return pb.collection('organizations').getFirstListItem(
      `subdomain = "${slug.replace(/"/g, '\\"')}"`,
      {
        fields: 'id,name,subdomain,plan,status,subscription_status,purge_scheduled_at,trial_ends_at,onboarding_state'
      }
    )
  }

  try {
    let record
    try {
      record = await lookup(false)
    } catch (error) {
      // Stale admin token after PocketBase restart → empty list / 404. Re-auth once.
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 0
      if (status === 401 || status === 403 || status === 404) {
        record = await lookup(true)
      } else {
        throw error
      }
    }

    return {
      id: record.id,
      name: String(record.name || slug),
      subdomain: String(record.subdomain || slug),
      plan: String(record.plan || 'free'),
      status: (record.status === 'closing' ? 'closing' : 'active') as 'active' | 'closing',
      subscription_status: String(record.subscription_status || ''),
      purge_scheduled_at: String(record.purge_scheduled_at || ''),
      trial_ends_at: String(record.trial_ends_at || ''),
      onboarding_state: (record.onboarding_state && typeof record.onboarding_state === 'object'
        ? record.onboarding_state
        : null) as TenantOrgPublic['onboarding_state']
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
      return null
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not resolve organization'
    })
  }
}
