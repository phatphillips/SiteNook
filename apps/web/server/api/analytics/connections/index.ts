import {
  ALL_ANALYTICS_PROVIDERS,
  PROVIDER_FIELD_SCHEMAS,
  PROVIDER_META,
  type ProviderCredentials
} from '../../../utils/analytics/types'
import {
  isAnalyticsProvider,
  requireOrgAdmin,
  requireOrgId,
  sanitizeConnection,
  buildCredentialsMeta,
  buildExternalIds,
  logAnalyticsActivity,
  validateCredentialFields
} from '../../../utils/analytics/connections'
import { encryptCredentials } from '../../../utils/analytics/crypto'
import { getAnalyticsAdapter, getGa4OAuthConfig } from '../../../utils/analytics'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  const pb = await getPbAdmin(event)

  if (event.method === 'GET') {
    const query = getQuery(event)
    const siteId = typeof query.siteId === 'string' ? query.siteId.trim() : ''
    const filter = siteId
      ? `organization = "${organizationId}" && site = "${siteId}"`
      : `organization = "${organizationId}"`

    const list = await pb.collection('analytics_connections').getFullList({
      filter,
      expand: 'site',
      sort: 'provider'
    })

    return {
      connections: list.map((row) => sanitizeConnection(row as any)),
      providers: ALL_ANALYTICS_PROVIDERS.map((id) => ({
        id,
        ...PROVIDER_META[id],
        fields: PROVIDER_FIELD_SCHEMAS[id]
      }))
    }
  }

  if (event.method === 'POST') {
    requireOrgAdmin(user)
    const body = await readBody(event)
    const provider = body?.provider
    const siteId = typeof body?.siteId === 'string' ? body.siteId.trim() : ''
    const credentials = (body?.credentials || {}) as ProviderCredentials
    const isReconnect = Boolean(body?.reconnect)

    if (!isAnalyticsProvider(provider)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid provider' })
    }
    if (!siteId) {
      throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
    }

    const site = await pb.collection('sites').getOne(siteId)
    if (String(site.organization) !== organizationId) {
      throw createError({ statusCode: 403, statusMessage: 'Site is not in your organization' })
    }

    const fieldError = validateCredentialFields(provider, credentials)
    if (fieldError) {
      throw createError({ statusCode: 400, statusMessage: fieldError })
    }

    const oauth = getGa4OAuthConfig(event)
    if (provider === 'ga4') {
      credentials.clientId = oauth.clientId
      credentials.clientSecret = oauth.clientSecret
    }

    const adapter = getAnalyticsAdapter(provider)
    const test = await adapter.testConnection(credentials)
    if (!test.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: test.error || 'Connection test failed'
      })
    }

    // Persist without client/server oauth secrets for non-token fields safety
    const toStore: ProviderCredentials = { ...credentials }
    if (provider === 'ga4') {
      delete toStore.clientId
      delete toStore.clientSecret
    }

    const encrypted = encryptCredentials(toStore, oauth.encryptionKey || undefined)
    const meta = buildCredentialsMeta(provider, toStore)
    const externalIds = buildExternalIds(provider, toStore)
    const payload = {
      organization: organizationId,
      site: siteId,
      provider,
      status: 'connected',
      credentials_encrypted: encrypted,
      credentials_meta: meta,
      external_ids: externalIds,
      last_error: '',
      last_sync_status: '',
      next_sync_at: new Date().toISOString(),
      sync_interval_hours: 12
    }

    const existing = await pb.collection('analytics_connections').getList(1, 1, {
      filter: `site = "${siteId}" && provider = '${provider}'`
    })

    let record
    const wasExisting = Boolean(existing.items[0])
    if (wasExisting) {
      record = await pb.collection('analytics_connections').update(existing.items[0].id, payload)
    } else {
      record = await pb.collection('analytics_connections').create(payload)
    }

    await logAnalyticsActivity(event, {
      organizationId,
      actorId: user.id,
      action: isReconnect || wasExisting ? 'analytics_reconnected' : 'analytics_connected',
      details: {
        provider,
        siteId,
        siteName: site.name,
        connectionId: record.id
      }
    })

    return { connection: sanitizeConnection(record as any) }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
