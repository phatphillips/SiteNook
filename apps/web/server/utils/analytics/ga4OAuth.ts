import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError, getRequestHeader, type H3Event } from 'h3'
import { getGa4OAuthConfig } from './index'

const STATE_TTL_MS = 15 * 60 * 1000

export interface Ga4OAuthState {
  organizationId: string
  siteId: string
  userId: string
  returnPath?: string
  exp: number
}

function stateSecret(event?: H3Event): string {
  const { clientSecret, encryptionKey } = getGa4OAuthConfig(event)
  const secret = clientSecret || encryptionKey
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'GA4 OAuth is not configured'
    })
  }
  return secret
}

export function encodeGa4OAuthState(event: H3Event | undefined, payload: Omit<Ga4OAuthState, 'exp'>): string {
  const body: Ga4OAuthState = { ...payload, exp: Date.now() + STATE_TTL_MS }
  const json = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')
  const sig = createHmac('sha256', stateSecret(event)).update(json).digest('base64url')
  return `${json}.${sig}`
}

export function decodeGa4OAuthState(event: H3Event | undefined, state: string): Ga4OAuthState {
  const [json, sig] = state.split('.')
  if (!json || !sig) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' })
  }
  const expected = createHmac('sha256', stateSecret(event)).update(json).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state signature' })
  }
  const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as Ga4OAuthState
  if (!payload.exp || Date.now() > payload.exp) {
    throw createError({ statusCode: 400, statusMessage: 'OAuth state expired' })
  }
  return payload
}

export function ga4AuthorizeUrl(event: H3Event, state: string, redirectUri: string): string {
  const { clientId } = getGa4OAuthConfig(event)
  if (!clientId) {
    throw createError({ statusCode: 503, statusMessage: 'GA4_OAUTH_CLIENT_ID is not configured' })
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/analytics.readonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeGa4Code(
  event: H3Event,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string, refreshToken?: string, expiresAt: string }> {
  const { clientId, clientSecret } = getGa4OAuthConfig(event)
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 503, statusMessage: 'GA4 OAuth client is not configured' })
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = await res.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.access_token) {
    throw createError({
      statusCode: 400,
      statusMessage: json.error_description || json.error || 'GA4 token exchange failed'
    })
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: String(Date.now() + (json.expires_in || 3600) * 1000)
  }
}

export function resolveGa4RedirectUri(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const appUrl = String(config.public.appUrl || '').replace(/\/$/, '')
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
  const proto = getRequestHeader(event, 'x-forwarded-proto') || 'http'
  if (host) {
    return `${proto}://${host}/api/analytics/oauth/ga4/callback`
  }
  return `${appUrl}/api/analytics/oauth/ga4/callback`
}
