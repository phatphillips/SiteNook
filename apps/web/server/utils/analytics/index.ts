import { createError, type H3Event } from 'h3'
import type { AnalyticsProvider } from '~/types/sitenook'
import type { AnalyticsProviderAdapter } from './types'
import { ga4Adapter } from './providers/ga4'
import { cloudflareAdapter } from './providers/cloudflare'
import { plausibleAdapter } from './providers/plausible'
import { umamiAdapter } from './providers/umami'
import { fathomAdapter } from './providers/fathom'
import { matomoAdapter } from './providers/matomo'

const adapters: Record<AnalyticsProvider, AnalyticsProviderAdapter> = {
  ga4: ga4Adapter,
  cloudflare: cloudflareAdapter,
  plausible: plausibleAdapter,
  umami: umamiAdapter,
  fathom: fathomAdapter,
  matomo: matomoAdapter
}

export function getAnalyticsAdapter(provider: AnalyticsProvider): AnalyticsProviderAdapter {
  const adapter = adapters[provider]
  if (!adapter) {
    throw createError({ statusCode: 400, statusMessage: `Unknown analytics provider: ${provider}` })
  }
  return adapter
}

export function getGa4OAuthConfig(event?: H3Event) {
  const config = useRuntimeConfig(event)
  return {
    clientId: String(config.ga4OAuthClientId || '').trim(),
    clientSecret: String(config.ga4OAuthClientSecret || '').trim(),
    encryptionKey: String(config.analyticsCredentialsEncryptionKey || process.env.ANALYTICS_CREDENTIALS_ENCRYPTION_KEY || '').trim()
  }
}
