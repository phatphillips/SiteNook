import { createError } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { getPbAdmin } from '../../../utils/pbAdmin'
import { canWriteOrg, requireUserOrganizationId } from '~/utils/orgAccess'
import { toPublicApiKey } from '../../../utils/apiKeys'

/** List org API keys (metadata only). Org admins only. */
export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  if (!canWriteOrg(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can manage API keys' })
  }
  const orgId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)

  const rows = await pb.collection('api_keys').getFullList({
    filter: `organization = "${orgId}"`,
    sort: '-created',
    requestKey: null
  })

  return {
    items: rows.map(toPublicApiKey)
  }
})
