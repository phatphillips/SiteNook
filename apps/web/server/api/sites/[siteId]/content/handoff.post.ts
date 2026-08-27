import { createError, getHeader, readBody, setHeader, getRouterParam } from 'h3'
import { markdownExportFilename } from '~/utils/contentExplorerTree'
import {
  buildHandoffTaskMarkdown,
  buildHandoffTreeMarkdown,
  wrapPageMarkdown
} from '~/utils/handoffPack'
import {
  type HandoffSectionId,
  isHandoffSectionId,
  parseHandoffPrompts,
  resolveActivePrompt
} from '~/utils/handoffSectionPrompts'
import { normalizePageUrl } from '~/utils/pageUrl'
import { loadHandoffFindingsByUrl } from '../../../../utils/handoffFindings'
import { requireSiteAccess } from '../../../../utils/requireSiteAccess'
import { pocketBaseFileUrl } from '../../../../utils/pocketbaseFileUrl'
import { buildStoreZip } from '../../../../utils/storeZip'

const PACK_KEEP = 10

function fileFieldName(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

async function fetchPbFileBuffer(
  pb: Awaited<ReturnType<typeof requireSiteAccess>>['pb'],
  record: Record<string, unknown>,
  filename: string,
  token: string
): Promise<Buffer | null> {
  if (!filename) return null
  const fileUrl = pocketBaseFileUrl(pb, record, filename)
  const response = await fetch(fileUrl, { headers: { Authorization: token } })
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}

function uniqueFilePath(preferred: string, used: Set<string>): string {
  if (!used.has(preferred)) {
    used.add(preferred)
    return preferred
  }
  const dot = preferred.lastIndexOf('.')
  const base = dot >= 0 ? preferred.slice(0, dot) : preferred
  const ext = dot >= 0 ? preferred.slice(dot) : '.md'
  let i = 2
  while (used.has(`${base}-${i}${ext}`)) i += 1
  const next = `${base}-${i}${ext}`
  used.add(next)
  return next
}

async function pruneOldPacks(
  pb: Awaited<ReturnType<typeof requireSiteAccess>>['pb'],
  siteId: string
) {
  const existing = await pb.collection('ai_handoff_packs').getFullList({
    filter: `site = "${siteId}"`,
    sort: '-created',
    fields: 'id'
  })
  const toDelete = existing.slice(PACK_KEEP)
  for (const row of toDelete) {
    try {
      await pb.collection('ai_handoff_packs').delete(row.id)
    } catch {
      // best-effort prune
    }
  }
}

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId') ?? ''
  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  const body = await readBody(event).catch(() => ({})) as {
    section?: string
    blobIds?: string[] | string
    pageIds?: string[] | string
    prompt?: string
  }

  if (!isHandoffSectionId(body.section)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid section is required' })
  }
  const section: HandoffSectionId = body.section

  const blobIds = Array.isArray(body.blobIds)
    ? body.blobIds.map(String).map(s => s.trim()).filter(Boolean)
    : typeof body.blobIds === 'string'
      ? body.blobIds.split(',').map(s => s.trim()).filter(Boolean)
      : []

  if (!blobIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'blobIds is required' })
  }

  const { pb, orgId, user } = await requireSiteAccess(event, siteId)
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const site = await pb.collection('sites').getOne(siteId, {
    fields: 'id,name,url,organization,handoff_prompts'
  }) as { id: string, name?: string, url?: string, handoff_prompts?: unknown }

  const stored = parseHandoffPrompts(site.handoff_prompts)
  const prompt = typeof body.prompt === 'string' && body.prompt.trim()
    ? body.prompt.trim()
    : resolveActivePrompt(stored, section)

  const usedPaths = new Set<string>()
  const pagesMeta: Array<{ url: string, title?: string, filePath: string, markdown: string }> = []

  for (const id of blobIds) {
    const blob = await pb.collection('page_content_blobs').getOne(id) as Record<string, unknown>
    if (String(blob.site ?? '') !== siteId) continue
    const filename = fileFieldName(blob.body)
    if (!filename) continue
    const buf = await fetchPbFileBuffer(pb, blob, filename, token)
    if (!buf) continue

    const obs = await pb.collection('page_content_observations').getList(1, 1, {
      filter: `content_blob = "${id}" && site = "${siteId}"`,
      sort: '-observed_at',
      fields: 'url,title'
    })
    const row = obs.items[0] as { url?: string, title?: string } | undefined
    const url = String(row?.url ?? id)
    const title = row?.title
    const filePath = uniqueFilePath(markdownExportFilename(url, title), usedPaths)
    pagesMeta.push({
      url,
      title,
      filePath,
      markdown: buf.toString('utf8')
    })
  }

  if (!pagesMeta.length) {
    throw createError({ statusCode: 404, statusMessage: 'No exportable content found' })
  }

  const findingsByUrl = await loadHandoffFindingsByUrl(
    pb,
    siteId,
    section,
    pagesMeta.map(page => page.url)
  )

  const pageFiles = pagesMeta.map((page) => {
    const findings = findingsByUrl.get(normalizePageUrl(page.url))
      || findingsByUrl.get(page.url)
      || undefined
    const content = wrapPageMarkdown({
      body: page.markdown,
      url: page.url,
      title: page.title,
      section,
      findingsBlock: findings
    })
    return {
      name: `pages/${page.filePath}`,
      data: Buffer.from(content, 'utf8')
    }
  })

  const taskMd = buildHandoffTaskMarkdown({
    prompt,
    siteName: String(site.name || 'Site'),
    siteUrl: String(site.url || ''),
    section,
    pageCount: pagesMeta.length
  })
  const treeMd = buildHandoffTreeMarkdown(
    pagesMeta.map(page => ({
      url: page.url,
      title: page.title,
      filePath: page.filePath
    }))
  )

  const zipBytes = buildStoreZip([
    { name: 'task.md', data: Buffer.from(taskMd, 'utf8') },
    { name: 'TREE.md', data: Buffer.from(treeMd, 'utf8') },
    ...pageFiles
  ])

  const artifactName = `ai-handoff-${section}-${pagesMeta.length}p.zip`
  const form = new FormData()
  form.append('org', orgId)
  form.append('site', siteId)
  form.append('section', section)
  form.append('prompt_snapshot', prompt.slice(0, 20000))
  form.append('page_urls', JSON.stringify(pagesMeta.map(page => page.url)))
  form.append('page_count', String(pagesMeta.length))
  form.append('created_by', String(user.id || ''))
  form.append('artifact', new Blob([new Uint8Array(zipBytes)], { type: 'application/zip' }), artifactName)

  try {
    await pb.collection('ai_handoff_packs').create(form)
    await pruneOldPacks(pb, siteId)
  } catch {
    // Still return the ZIP even if persistence fails
  }

  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${artifactName}"`)
  return zipBytes
})
