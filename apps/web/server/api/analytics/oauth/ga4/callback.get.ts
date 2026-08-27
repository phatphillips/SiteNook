import { encryptCredentials } from '../../../../utils/analytics/crypto'
import { getGa4OAuthConfig } from '../../../../utils/analytics'
import {
  buildCredentialsMeta,
  buildExternalIds,
  logAnalyticsActivity
} from '../../../../utils/analytics/connections'
import {
  decodeGa4OAuthState,
  exchangeGa4Code,
  resolveGa4RedirectUri
} from '../../../../utils/analytics/ga4OAuth'
import { getAnalyticsAdapter } from '../../../../utils/analytics'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code.trim() : ''
  const stateRaw = typeof query.state === 'string' ? query.state.trim() : ''
  const error = typeof query.error === 'string' ? query.error.trim() : ''

  const config = useRuntimeConfig(event)
  const appUrl = String(config.public.appUrl || '').replace(/\/$/, '')
  const returnBase = (() => {
    const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
    const proto = getRequestHeader(event, 'x-forwarded-proto') || 'http'
    return host ? `${proto}://${host}` : appUrl
  })()

  if (error || !code || !stateRaw) {
    return sendRedirect(
      event,
      `${returnBase}/settings/integrations?ga4=error&message=${encodeURIComponent(error || 'OAuth cancelled')}`
    )
  }

  try {
    const state = decodeGa4OAuthState(event, stateRaw)
    const redirectUri = resolveGa4RedirectUri(event)
    const tokens = await exchangeGa4Code(event, code, redirectUri)
    const oauth = getGa4OAuthConfig(event)

    const credentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || '',
      expiresAt: tokens.expiresAt
    }

    const adapter = getAnalyticsAdapter('ga4')
    const test = await adapter.testConnection({
      ...credentials,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret
    })
    if (!test.ok) {
      return sendRedirect(
        event,
        `${returnBase}/settings/integrations?ga4=error&message=${encodeURIComponent(test.error || 'Token test failed')}`
      )
    }

    const pb = await getPbAdmin(event)
    const site = await pb.collection('sites').getOne(state.siteId)
    const encrypted = encryptCredentials(credentials, oauth.encryptionKey || undefined)
    const meta = buildCredentialsMeta('ga4', credentials)
    const externalIds = buildExternalIds('ga4', credentials)

    const existing = await pb.collection('analytics_connections').getList(1, 1, {
      filter: `site = "${state.siteId}" && provider = 'ga4'`
    })

    const payload = {
      organization: state.organizationId,
      site: state.siteId,
      provider: 'ga4',
      status: 'connected',
      credentials_encrypted: encrypted,
      credentials_meta: {
        ...meta,
        pendingPropertySelection: true
      },
      external_ids: externalIds,
      last_error: '',
      next_sync_at: new Date().toISOString(),
      sync_interval_hours: 12
    }

    let connectionId: string
    if (existing.items[0]) {
      const updated = await pb.collection('analytics_connections').update(existing.items[0].id, payload)
      connectionId = updated.id
    } else {
      const created = await pb.collection('analytics_connections').create(payload)
      connectionId = created.id
    }

    await logAnalyticsActivity(event, {
      organizationId: state.organizationId,
      actorId: state.userId,
      action: existing.items[0] ? 'analytics_reconnected' : 'analytics_connected',
      details: {
        provider: 'ga4',
        siteId: state.siteId,
        siteName: site.name,
        connectionId
      }
    })

    return sendRedirect(
      event,
      `${returnBase}/settings/integrations?ga4=pick_property&connectionId=${encodeURIComponent(connectionId)}&siteId=${encodeURIComponent(state.siteId)}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth failed'
    return sendRedirect(
      event,
      `${returnBase}/settings/integrations?ga4=error&message=${encodeURIComponent(message)}`
    )
  }
})
