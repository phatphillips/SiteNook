import {
  requireOrgAdmin,
  requireOrgId,
  sanitizeConnection,
  buildCredentialsMeta
} from '../../../../utils/analytics/connections'
import { decryptCredentials, encryptCredentials } from '../../../../utils/analytics/crypto'
import { getGa4OAuthConfig } from '../../../../utils/analytics'
import type { ProviderCredentials } from '../../../../utils/analytics/types'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  requireOrgAdmin(user)

  const id = getRouterParam(event, 'id')?.trim()
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Connection id is required' })
  }

  const body = await readBody(event)
  const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : ''
  const propertyLabel = typeof body?.propertyLabel === 'string' ? body.propertyLabel.trim() : ''
  if (!propertyId) {
    throw createError({ statusCode: 400, statusMessage: 'propertyId is required' })
  }

  const pb = await getPbAdmin(event)
  const connection = await pb.collection('analytics_connections').getOne(id)
  if (String(connection.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Connection not in your organization' })
  }
  if (connection.provider !== 'ga4') {
    throw createError({ statusCode: 400, statusMessage: 'Only GA4 connections support property selection' })
  }

  const oauth = getGa4OAuthConfig(event)
  const credentials = decryptCredentials<ProviderCredentials>(
    String(connection.credentials_encrypted || ''),
    oauth.encryptionKey || undefined
  )
  credentials.propertyId = propertyId
  if (propertyLabel) credentials.propertyLabel = propertyLabel

  const updated = await pb.collection('analytics_connections').update(id, {
    credentials_encrypted: encryptCredentials(credentials, oauth.encryptionKey || undefined),
    credentials_meta: {
      ...buildCredentialsMeta('ga4', credentials, { propertyLabel: propertyLabel || propertyId }),
      pendingPropertySelection: false
    },
    external_ids: { propertyId },
    status: 'connected',
    next_sync_at: new Date().toISOString()
  })

  return { connection: sanitizeConnection(updated as any) }
})
