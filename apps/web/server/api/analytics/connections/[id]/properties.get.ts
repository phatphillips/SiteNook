import { requireOrgAdmin, requireOrgId } from '../../../../utils/analytics/connections'
import { decryptCredentials } from '../../../../utils/analytics/crypto'
import { getAnalyticsAdapter, getGa4OAuthConfig } from '../../../../utils/analytics'
import type { ProviderCredentials } from '../../../../utils/analytics/types'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  requireOrgAdmin(user)

  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Connection id is required' })
  }

  const pb = await getPbAdmin(event)
  const connection = await pb.collection('analytics_connections').getOne(id)
  if (String(connection.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Connection not in your organization' })
  }
  if (connection.provider !== 'ga4') {
    throw createError({ statusCode: 400, statusMessage: 'Property listing is only available for GA4' })
  }

  const oauth = getGa4OAuthConfig(event)
  const credentials = decryptCredentials<ProviderCredentials>(
    String(connection.credentials_encrypted || ''),
    oauth.encryptionKey || undefined
  )
  credentials.clientId = oauth.clientId
  credentials.clientSecret = oauth.clientSecret

  const adapter = getAnalyticsAdapter('ga4')
  if (!adapter.listSelectableResources) {
    throw createError({ statusCode: 500, statusMessage: 'GA4 adapter missing property listing' })
  }

  const resources = await adapter.listSelectableResources(credentials)
  return { properties: resources }
})
