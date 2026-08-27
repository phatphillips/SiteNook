import { createError, getRouterParam } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { getPbAdmin } from '../../../utils/pbAdmin'
import { canWriteOrg, requireUserOrganizationId } from '~/utils/orgAccess'
import { toPublicApiKey } from '../../../utils/apiKeys'

/** Revoke an API key (soft delete via revoked_at). */
export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  if (!canWriteOrg(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can manage API keys' })
  }
  const orgId = requireUserOrganizationId(user)
  const keyId = getRouterParam(event, 'id') ?? ''
  if (!keyId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'id is required' })
  }

  const pb = await getPbAdmin(event)
  let record
  try {
    record = await pb.collection('api_keys').getOne(keyId)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }

  if (String(record.organization) !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (record.revoked_at) {
    return { item: toPublicApiKey(record) }
  }

  const updated = await pb.collection('api_keys').update(keyId, {
    revoked_at: new Date().toISOString()
  })

  return { item: toPublicApiKey(updated) }
})
