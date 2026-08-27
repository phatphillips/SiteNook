import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, type H3Event } from 'h3'

export const SNAPSHOT_TICKET_TTL_MS = 15 * 60 * 1000

export interface SnapshotTicketPayload {
  uid: string
  siteId: string
  pageId: string
  exp: number
}

function signingSecret(event?: H3Event): string {
  let secret = ''
  try {
    const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
    secret = String(
      config.previewSigningSecret
      || config.licenceSigningSecret
      || config.pbAdminPassword
      || ''
    ).trim()
  } catch {
    secret = ''
  }
  if (!secret) {
    secret = String(
      process.env.NUXT_PREVIEW_SIGNING_SECRET
      || process.env.NUXT_LICENCE_SIGNING_SECRET
      || process.env.NUXT_PB_ADMIN_PASSWORD
      || process.env.PB_ADMIN_PASSWORD
      || ''
    ).trim()
  }
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Preview signing is not configured'
    })
  }
  return secret
}

function encodeBody(payload: SnapshotTicketPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function signBody(body: string, event?: H3Event): string {
  return createHmac('sha256', signingSecret(event)).update(body).digest('base64url')
}

export function signSnapshotTicket(
  payload: Omit<SnapshotTicketPayload, 'exp'>,
  event?: H3Event,
  now = Date.now()
): string {
  const body = encodeBody({ ...payload, exp: now + SNAPSHOT_TICKET_TTL_MS })
  return `${body}.${signBody(body, event)}`
}

export function verifySnapshotTicket(ticket: string, event?: H3Event): SnapshotTicketPayload {
  const [body, sig] = ticket.split('.')
  if (!body || !sig) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid snapshot ticket' })
  }
  const expected = signBody(body, event)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid snapshot ticket' })
  }

  let payload: SnapshotTicketPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SnapshotTicketPayload
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid snapshot ticket' })
  }

  if (!payload.uid || !payload.siteId || !payload.pageId || !payload.exp) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid snapshot ticket' })
  }
  if (Date.now() > payload.exp) {
    throw createError({ statusCode: 401, statusMessage: 'Snapshot ticket expired' })
  }
  return payload
}

export function assertSnapshotTicketMatches(
  payload: SnapshotTicketPayload,
  siteId: string,
  pageId: string
): void {
  if (payload.siteId !== siteId || payload.pageId !== pageId) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid snapshot ticket' })
  }
}

export function buildPageSnapshotUrl(siteId: string, pageId: string, ticket: string): string {
  return `/api/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/snapshot?ticket=${encodeURIComponent(ticket)}`
}

export function buildPageLivePreviewUrl(siteId: string, pageId: string, ticket: string): string {
  return `/api/sites/${encodeURIComponent(siteId)}/pages/${encodeURIComponent(pageId)}/live-preview?ticket=${encodeURIComponent(ticket)}`
}
