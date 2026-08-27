import { createError, type H3Event } from 'h3'
import type {
  AnalyticsConnection,
  AnalyticsCredentialsMeta,
  AnalyticsExternalIds,
  AnalyticsProvider
} from '~/types/sitenook'
import { getPbAdmin } from '../pbAdmin'
import { maskSecretLast4 } from './crypto'
import { PROVIDER_FIELD_SCHEMAS, type ProviderCredentials } from './types'

export function requireOrgId(user: { organization?: unknown }): string {
  const organizationId = typeof user.organization === 'string' ? user.organization.trim() : ''
  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Your account is not assigned to an organization.'
    })
  }
  return organizationId
}

export function requireOrgAdmin(user: { role?: unknown }) {
  if (String(user.role || '') !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only organization admins can manage analytics integrations.'
    })
  }
}

export function isAnalyticsProvider(value: unknown): value is AnalyticsProvider {
  return (
    value === 'ga4'
    || value === 'cloudflare'
    || value === 'plausible'
    || value === 'umami'
    || value === 'fathom'
    || value === 'matomo'
  )
}

export function sanitizeConnection(record: Record<string, any>): AnalyticsConnection {
  const {
    credentials_encrypted: _omit,
    ...rest
  } = record
  return rest as AnalyticsConnection
}

export function buildCredentialsMeta(
  provider: AnalyticsProvider,
  credentials: ProviderCredentials,
  extra?: Partial<AnalyticsCredentialsMeta>
): AnalyticsCredentialsMeta {
  const secretKeys = ['apiToken', 'apiKey', 'tokenAuth', 'accessToken', 'refreshToken']
  let last4: string | undefined
  for (const key of secretKeys) {
    last4 = maskSecretLast4(credentials[key])
    if (last4) break
  }

  let instanceUrlHost: string | undefined
  if (credentials.instanceUrl) {
    try {
      instanceUrlHost = new URL(credentials.instanceUrl).host
    } catch {
      instanceUrlHost = undefined
    }
  }

  return {
    hasRefreshToken: Boolean(credentials.refreshToken),
    last4,
    instanceUrlHost,
    propertyLabel: credentials.propertyLabel || extra?.propertyLabel,
    ...extra
  }
}

export function buildExternalIds(
  provider: AnalyticsProvider,
  credentials: ProviderCredentials
): AnalyticsExternalIds {
  switch (provider) {
    case 'ga4':
      return { propertyId: credentials.propertyId }
    case 'cloudflare':
      return { zoneId: credentials.zoneId }
    case 'plausible':
    case 'fathom':
    case 'matomo':
      return { siteId: credentials.siteId }
    case 'umami':
      return { websiteId: credentials.websiteId }
    default:
      return {}
  }
}

export function validateCredentialFields(
  provider: AnalyticsProvider,
  credentials: ProviderCredentials
): string | null {
  const schema = PROVIDER_FIELD_SCHEMAS[provider]
  for (const field of schema) {
    if (!field.required) continue
    if (!String(credentials[field.key] ?? '').trim()) {
      return `${field.label} is required`
    }
  }
  if (provider === 'ga4') {
    if (!credentials.accessToken && !credentials.refreshToken) {
      return 'GA4 OAuth credentials are missing'
    }
  }
  return null
}

export async function logAnalyticsActivity(
  event: H3Event,
  input: {
    organizationId: string
    actorId?: string | null
    action:
      | 'analytics_connected'
      | 'analytics_disconnected'
      | 'analytics_reconnected'
      | 'analytics_sync_needs_reconnect'
    details: Record<string, unknown>
  }
) {
  try {
    const pb = await getPbAdmin(event)
    await pb.collection('team_activity_log').create({
      organization: input.organizationId,
      actor: input.actorId || '',
      action: input.action,
      details: input.details,
      logged_at: new Date().toISOString()
    })
  } catch (error) {
    console.warn('[analytics] team_activity_log write failed:', error)
  }
}

export function defaultNextSyncAt(intervalHours = 12): string {
  const next = new Date()
  next.setTime(next.getTime() + intervalHours * 60 * 60 * 1000)
  return next.toISOString()
}
