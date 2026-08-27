import { createError, readBody } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { getPbAdmin } from '../../../utils/pbAdmin'
import { canWriteOrg, requireUserOrganizationId } from '~/utils/orgAccess'
import {
  generateApiKeySecret,
  normalizeScopes,
  toPublicApiKey,
  type ApiKeyScope
} from '../../../utils/apiKeys'

/** Create an org API key. Returns plaintext once. Org admins only. */
export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  if (!canWriteOrg(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can manage API keys' })
  }
  const orgId = requireUserOrganizationId(user)
  const body = await readBody<{ name?: string, scopes?: ApiKeyScope[] }>(event)

  const name = String(body?.name || '').trim()
  if (!name || name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'name is required (max 120 characters)' })
  }

  const scopes = normalizeScopes(body?.scopes?.length ? body.scopes : ['read', 'write'])
  const { plaintext, prefix, hash } = generateApiKeySecret()
  const pb = await getPbAdmin(event)

  const record = await pb.collection('api_keys').create({
    organization: orgId,
    name,
    key_prefix: prefix,
    key_hash: hash,
    scopes,
    created_by: user.id
  })

  return {
    key: plaintext,
    item: toPublicApiKey(record)
  }
})
