import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface LicenceTokenPayload {
  key: string
  tier: string
  domain: string
  fingerprint: string
  expires_at: string
  token_expires_at: string
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signingSecret(event?: H3Event): string {
  let secret = ''
  try {
    const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
    secret = String(config.licenceSigningSecret || '').trim()
  } catch {
    secret = ''
  }
  if (!secret) {
    secret = String(process.env.NUXT_LICENCE_SIGNING_SECRET || '').trim()
  }
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Licence signing is not configured'
    })
  }
  return secret
}

export function signLicenceToken(
  payload: LicenceTokenPayload,
  event?: H3Event
): string {
  const body = base64UrlEncode(JSON.stringify(payload))
  const signature = createHmac('sha256', signingSecret(event))
    .update(body)
    .digest('base64url')
  return `${body}.${signature}`
}

export function verifyLicenceToken(
  token: string,
  event?: H3Event
): LicenceTokenPayload {
  const [body, signature] = token.split('.')
  if (!body || !signature) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid licence token' })
  }

  const expected = createHmac('sha256', signingSecret(event))
    .update(body)
    .digest('base64url')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid licence token signature' })
  }

  let payload: LicenceTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(body)) as LicenceTokenPayload
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid licence token payload' })
  }

  if (Date.parse(payload.token_expires_at) < Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'Licence token expired' })
  }

  return payload
}

export function buildLicenceTokenPayload(input: {
  key: string
  tier: string
  domain: string
  fingerprint: string
  expires_at: string
}): LicenceTokenPayload {
  return {
    ...input,
    token_expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  }
}

export function requireLicenceAdminKey(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const expected = String(config.licenceAdminKey || '').trim()
  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Licence admin API is not configured'
    })
  }

  const header = getHeader(event, 'x-licence-admin-key')
    || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  if (!header || header.trim() !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

export function hashInstanceFingerprint(domain: string, instanceFingerprint: string): string {
  return createHmac('sha256', 'accessiq-licence-fingerprint')
    .update(`${domain.trim().toLowerCase()}|${instanceFingerprint.trim()}`)
    .digest('hex')
}
