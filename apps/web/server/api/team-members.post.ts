import { createError, readBody } from 'h3'
import { ClientResponseError } from 'pocketbase'
import { getPbAdmin } from '../utils/pbAdmin'
import { requirePbUser } from '../utils/requirePbUser'

interface CreateTeamMemberBody {
  name?: string
  email?: string
  role?: string
  password?: string
  sendSetupEmail?: boolean
}

/** Create a teammate with a shared password. Superuser sets verified so they can sign in immediately. */
export default defineEventHandler(async (event) => {
  const actor = await requirePbUser(event)
  if (String(actor.role || '') !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can add team members.' })
  }

  const organizationId = typeof actor.organization === 'string' ? actor.organization : ''
  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Your account is not assigned to an organization.' })
  }

  const body = await readBody<CreateTeamMemberBody>(event)
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const role = body?.role === 'admin' ? 'admin' : body?.role === 'viewer' ? 'viewer' : ''
  const password = String(body?.password || '')

  if (!name || !email) {
    throw createError({ statusCode: 400, statusMessage: 'Name and email are required.' })
  }
  if (!role) {
    throw createError({ statusCode: 400, statusMessage: 'Role must be admin or viewer.' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters.' })
  }

  const pb = await getPbAdmin(event)

  let record
  try {
    record = await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm: password,
      role,
      organization: organizationId,
      emailVisibility: true,
      verified: true,
      is_billing_contact: false
    })
  } catch (error) {
    if (error instanceof ClientResponseError) {
      throw createError({
        statusCode: error.status || 400,
        statusMessage: error.message || 'Could not create team member.'
      })
    }
    throw error
  }

  await pb.collection('team_activity_log').create({
    organization: organizationId,
    actor: actor.id,
    target: record.id,
    action: 'member_added',
    details: { role }
  }).catch(() => {})

  let emailSent = false
  let emailError: string | undefined
  if (body?.sendSetupEmail) {
    try {
      await pb.collection('users').requestPasswordReset(email)
      emailSent = true
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Setup email could not be sent.'
    }
  }

  return {
    id: record.id,
    name: String(record.name || name),
    email: String(record.email || email),
    role: String(record.role || role),
    is_billing_contact: Boolean(record.is_billing_contact),
    verified: Boolean(record.verified),
    created: String(record.created || ''),
    emailSent,
    emailError
  }
})
