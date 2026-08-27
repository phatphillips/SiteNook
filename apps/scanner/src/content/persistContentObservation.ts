import type PocketBase from 'pocketbase'
import { hashMarkdownContent } from './contentHash.js'

/**
 * When the content KB migration (1730000063) has not been applied, the
 * page_content_* collections do not exist. Detect that once and skip content
 * persistence for the rest of the run instead of issuing a failing request per page.
 */
let contentCollectionsMissing = false

export function contentPersistenceDisabled(): boolean {
  return contentCollectionsMissing
}

function isMissingCollectionError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'status' in err && Number((err as { status: number }).status) === 404)
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function markdownFilename(contentHash: string): string {
  return `content-${contentHash.slice(0, 16)}.md`
}

async function resolveOrganizationId(pb: PocketBase, siteId: string): Promise<string> {
  const site = await pb.collection('sites').getOne(siteId, { fields: 'organization' })
  const org = (site as { organization?: string }).organization
  if (!org) throw new Error(`Site ${siteId} has no organization`)
  return org
}

async function findBlobByHash(
  pb: PocketBase,
  siteId: string,
  contentHash: string
): Promise<{ id: string } | null> {
  try {
    const result = await pb.collection('page_content_blobs').getList(1, 1, {
      filter: `site = "${escapeFilterValue(siteId)}" && content_hash = "${escapeFilterValue(contentHash)}"`,
      fields: 'id'
    })
    return result.items[0] ? { id: result.items[0].id } : null
  } catch {
    return null
  }
}

async function findPriorObservation(
  pb: PocketBase,
  siteId: string,
  pageUrl: string,
  excludeScanId: string
): Promise<{ id: string, content_hash?: string } | null> {
  try {
    const result = await pb.collection('page_content_observations').getList(1, 1, {
      filter: [
        `site = "${escapeFilterValue(siteId)}"`,
        `url = "${escapeFilterValue(pageUrl)}"`,
        `scan != "${escapeFilterValue(excludeScanId)}"`
      ].join(' && '),
      sort: '-observed_at',
      fields: 'id,content_hash'
    })
    return result.items[0]
      ? { id: result.items[0].id, content_hash: String((result.items[0] as { content_hash?: string }).content_hash ?? '') }
      : null
  } catch {
    return null
  }
}

async function upsertContentBlob(
  pb: PocketBase,
  input: {
    organizationId: string
    siteId: string
    contentHash: string
    markdown: string
    now: string
  }
): Promise<string> {
  const existing = await findBlobByHash(pb, input.siteId, input.contentHash)
  if (existing) {
    try {
      await pb.collection('page_content_blobs').update(existing.id, { last_seen_at: input.now })
    } catch {
      // non-fatal
    }
    return existing.id
  }

  const buffer = Buffer.from(input.markdown, 'utf8')
  const form = new FormData()
  form.append('organization', input.organizationId)
  form.append('site', input.siteId)
  form.append('content_hash', input.contentHash)
  form.append('content_kind', 'markdown')
  form.append('byte_size', String(buffer.byteLength))
  form.append('char_count', String(input.markdown.length))
  form.append('first_seen_at', input.now)
  form.append('last_seen_at', input.now)
  form.append(
    'body',
    new Blob([buffer], { type: 'text/markdown' }),
    markdownFilename(input.contentHash)
  )

  const created = await pb.collection('page_content_blobs').create(form)
  return created.id
}

export interface PersistContentObservationInput {
  scanId: string
  siteId: string
  pageId: string
  pageUrl: string
  title: string
  markdown: string
  observedAt?: string
}

export interface PersistContentObservationResult {
  blobId: string
  observationId: string
  contentHash: string
  unchanged: boolean
}

/**
 * Store deduplicated Markdown blob and per-scan observation; returns fields for pages update.
 */
export async function persistContentObservation(
  pb: PocketBase,
  input: PersistContentObservationInput
): Promise<PersistContentObservationResult | null> {
  if (contentCollectionsMissing) return null

  const contentHash = hashMarkdownContent(input.markdown)
  const now = input.observedAt ?? new Date().toISOString()
  const organizationId = await resolveOrganizationId(pb, input.siteId)

  let blobId: string
  try {
    blobId = await upsertContentBlob(pb, {
      organizationId,
      siteId: input.siteId,
      contentHash,
      markdown: input.markdown,
      now
    })
  } catch (err) {
    if (isMissingCollectionError(err)) {
      contentCollectionsMissing = true
      console.warn(
        'Content KB collections missing (migration 1730000063 not applied) — skipping content capture for this run'
      )
      return null
    }
    throw err
  }

  const prior = await findPriorObservation(pb, input.siteId, input.pageUrl, input.scanId)
  const unchanged = Boolean(prior && prior.content_hash === contentHash)

  const observation = await pb.collection('page_content_observations').create({
    organization: organizationId,
    site: input.siteId,
    scan: input.scanId,
    page: input.pageId,
    url: input.pageUrl,
    content_blob: blobId,
    content_hash: contentHash,
    unchanged,
    ...(prior ? { previous_observation: prior.id } : {}),
    observed_at: now,
    title: input.title?.trim() || ''
  })

  return {
    blobId,
    observationId: observation.id,
    contentHash,
    unchanged
  }
}
