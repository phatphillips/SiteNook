import { createError, getRouterParam } from 'h3'
import { requireAgentAuth, requireAgentWrite } from '../../../../utils/requireAgentAuth'

/**
 * Cancel a pending/processing scan_queue item (or mark a running scan cancelled).
 * Pass either a scan_queue id or a scans id.
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireAgentAuth(event)
  requireAgentWrite(ctx)
  const id = getRouterParam(event, 'id') ?? ''
  if (!id.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  try {
    const queueItem = await ctx.pb.collection('scan_queue').getOne(id, {
      fields: 'id,site,status',
      expand: 'site'
    })
    const siteOrg = typeof queueItem.expand?.site === 'object'
      ? String((queueItem.expand.site as { organization?: string }).organization || '')
      : ''

    if (siteOrg) {
      if (siteOrg !== ctx.orgId) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
      }
    } else {
      const site = await ctx.pb.collection('sites').getOne(String(queueItem.site), {
        fields: 'id,organization'
      })
      if (String(site.organization) !== ctx.orgId) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
      }
    }

    const status = String(queueItem.status || '')
    if (status === 'pending' || status === 'processing') {
      await ctx.pb.collection('scan_queue').update(id, { status: 'cancelled' })
      return { id, kind: 'scan_queue', status: 'cancelled' }
    }
    return { id, kind: 'scan_queue', status, message: 'Already finished or cancelled' }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
  }

  try {
    const scan = await ctx.pb.collection('scans').getOne(id, { fields: 'id,site,status' })
    const site = await ctx.pb.collection('sites').getOne(String(scan.site), {
      fields: 'id,organization'
    })
    if (String(site.organization) !== ctx.orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    if (scan.status === 'running' || scan.status === 'queued') {
      await ctx.pb.collection('scans').update(id, { status: 'cancelled' })
      return { id, kind: 'scan', status: 'cancelled' }
    }
    return { id, kind: 'scan', status: scan.status, message: 'Already finished or cancelled' }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 404, statusMessage: 'Queue item or scan not found' })
  }
})
