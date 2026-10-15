import { createError, getRouterParam, readBody } from 'h3'
import { requireSiteAccess } from '../../../../../utils/requireSiteAccess'
import { recomputeDashboardRollupsForSite } from '../../../../../utils/dashboardRollups'
import {
  brokenLinkStatusForRecheck,
  checkBrokenLinkUrl
} from '../../../../../utils/checkBrokenLink'
import { pbAnd, pbRelation } from '~/utils/pbFilter'

function pbUrlEquals(field: string, value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
  return `${field} = '${escaped}'`
}

type BrokenLinkRecord = {
  id: string
  href: string
  scan: string
  status: string
  status_code: number
}

function siteOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url.replace(/\/$/, '')
  }
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  const { pb } = await requireSiteAccess(event, siteId)
  const body = await readBody<{
    issueIds?: string[]
    href?: string
  }>(event)

  const issueIds = Array.isArray(body?.issueIds) ? body.issueIds.filter(Boolean) : []
  const href = typeof body?.href === 'string' ? body.href.trim() : ''

  if (!issueIds.length && !href) {
    throw createError({ statusCode: 400, statusMessage: 'issueIds or href is required' })
  }

  const site = await pb.collection('sites').getOne(siteId, { fields: 'id,url' }) as {
    id: string
    url?: string
  }
  const origin = siteOrigin(site.url || '')

  let targetHref = href
  let records: BrokenLinkRecord[] = []

  if (issueIds.length) {
    const fetched = await Promise.all(
      issueIds.map(async (id) => {
        try {
          return await pb.collection('qa_broken_links').getOne(id) as BrokenLinkRecord
        } catch {
          return null
        }
      })
    )
    records = fetched.filter((row): row is BrokenLinkRecord => Boolean(row))
    if (!records.length) {
      throw createError({ statusCode: 404, statusMessage: 'Broken link record not found' })
    }
    targetHref = records[0]!.href
    // Expand to all same-href rows on the same scan (links view aggregates by href).
    const scanId = records[0]!.scan
    if (scanId && targetHref) {
      const siblings = await pb.collection('qa_broken_links').getFullList<BrokenLinkRecord>({
        filter: pbAnd([pbRelation('scan', scanId), pbUrlEquals('href', targetHref)]),
        fields: 'id,href,scan,status,status_code'
      })
      const byId = new Map(records.map(row => [row.id, row]))
      for (const row of siblings) byId.set(row.id, row)
      records = [...byId.values()]
    }
  } else {
    // href-only: latest completed scan for the site
    const latestScan = await pb.collection('scans').getList(1, 1, {
      filter: pbAnd([pbRelation('site', siteId), `status = 'complete'`]),
      sort: '-created',
      fields: 'id'
    })
    const scanId = latestScan.items[0]?.id as string | undefined
    if (!scanId) {
      throw createError({ statusCode: 404, statusMessage: 'No completed scan found for this site' })
    }
    records = await pb.collection('qa_broken_links').getFullList<BrokenLinkRecord>({
      filter: pbAnd([pbRelation('scan', scanId), pbUrlEquals('href', targetHref)]),
      fields: 'id,href,scan,status,status_code'
    })
    if (!records.length) {
      throw createError({ statusCode: 404, statusMessage: 'No broken link rows found for that URL' })
    }
  }

  const check = await checkBrokenLinkUrl(targetHref, origin)
  const nextStatus = brokenLinkStatusForRecheck(check.status)
  const patch = {
    status: nextStatus,
    status_code: check.status_code,
    link_type: check.link_type
  }

  await Promise.all(records.map(row => pb.collection('qa_broken_links').update(row.id, patch)))
  await recomputeDashboardRollupsForSite(pb, siteId)

  return {
    ok: true,
    href: targetHref,
    status: check.status,
    status_code: check.status_code,
    link_type: check.link_type,
    stored_status: nextStatus,
    updated: records.length,
    issueIds: records.map(row => row.id)
  }
})
