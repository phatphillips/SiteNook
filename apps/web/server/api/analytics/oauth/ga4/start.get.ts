import { requireOrgAdmin, requireOrgId } from '../../../../utils/analytics/connections'
import {
  encodeGa4OAuthState,
  ga4AuthorizeUrl,
  resolveGa4RedirectUri
} from '../../../../utils/analytics/ga4OAuth'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const organizationId = requireOrgId(user)
  requireOrgAdmin(user)

  const query = getQuery(event)
  const siteId = typeof query.siteId === 'string' ? query.siteId.trim() : ''
  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  const pb = await getPbAdmin(event)
  const site = await pb.collection('sites').getOne(siteId)
  if (String(site.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Site is not in your organization' })
  }

  const redirectUri = resolveGa4RedirectUri(event)
  const state = encodeGa4OAuthState(event, {
    organizationId,
    siteId,
    userId: user.id,
    returnPath: '/settings/integrations'
  })
  const url = ga4AuthorizeUrl(event, state, redirectUri)
  return { url }
})
