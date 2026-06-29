import { createError } from 'h3'
import { getPbAdmin } from '../utils/pbAdmin'
import { requirePbUser } from '../utils/requirePbUser'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can log team activity.' })
  }

  const body = await readBody(event)
  const targetId = typeof body?.targetId === 'string' ? body.targetId.trim() : ''
  const action = typeof body?.action === 'string' ? body.action.trim() : ''

  if (!targetId || action !== 'invite_resent') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid team activity payload.' })
  }

  const organizationId = typeof user.organization === 'string'
    ? user.organization
    : ''

  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Your account is not assigned to an organization.' })
  }

  const pb = await getPbAdmin(event)
  const target = await pb.collection('users').getOne(targetId, { fields: 'id,organization' })
  if (String(target.organization) !== organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Target user is not in your organization.' })
  }

  await pb.collection('team_activity_log').create({
    organization: organizationId,
    actor: user.id,
    target: targetId,
    action: 'invite_resent'
  })

  return { ok: true }
})
