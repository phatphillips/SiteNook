import {
  isAnalyticsProvider,
  requireOrgAdmin,
  requireOrgId
} from '../../../utils/analytics/connections'
import { getAnalyticsAdapter, getGa4OAuthConfig } from '../../../utils/analytics'
import { validateCredentialFields } from '../../../utils/analytics/connections'
import type { ProviderCredentials } from '../../../utils/analytics/types'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  requireOrgId(user)
  requireOrgAdmin(user)

  const body = await readBody(event)
  const provider = body?.provider
  const credentials = (body?.credentials || {}) as ProviderCredentials

  if (!isAnalyticsProvider(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider' })
  }

  const fieldError = validateCredentialFields(provider, credentials)
  if (fieldError) {
    throw createError({ statusCode: 400, statusMessage: fieldError })
  }

  if (provider === 'ga4') {
    const oauth = getGa4OAuthConfig(event)
    credentials.clientId = oauth.clientId
    credentials.clientSecret = oauth.clientSecret
  }

  const adapter = getAnalyticsAdapter(provider)
  const result = await adapter.testConnection(credentials)
  return result
})
