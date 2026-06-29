import { createError, type H3Event } from 'h3'
import type { TenantOrgPublic } from '~/types/tenant'
// getPbAdmin — auto-imported from server/utils/

export async function resolveOrgBySubdomain(
  subdomain: string,
  event: H3Event
): Promise<TenantOrgPublic | null> {
  const slug = subdomain.trim().toLowerCase()
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return null

  try {
    const pb = await getPbAdmin(event)
    const record = await pb.collection('organizations').getFirstListItem(
      `subdomain = "${slug.replace(/"/g, '\\"')}"`,
      { fields: 'id,name,subdomain,plan,status,subscription_status,purge_scheduled_at' }
    )

    return {
      id: record.id,
      name: String(record.name || slug),
      subdomain: String(record.subdomain || slug),
      plan: String(record.plan || 'free'),
      status: (record.status === 'closing' ? 'closing' : 'active') as 'active' | 'closing',
      subscription_status: String(record.subscription_status || ''),
      purge_scheduled_at: String(record.purge_scheduled_at || '')
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
