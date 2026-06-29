import { createError } from 'h3'
import type { RecordModel } from 'pocketbase'
import { closeOrganization } from '../utils/closeOrganization'
import { notifyOrgClosureEmails } from '../utils/orgClosureNotify'
import { isOrgAdmin, requireUserOrganizationId } from '~/utils/orgAccess'

interface CloseOrganizationBody {
  confirmName?: string
}

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event) as RecordModel
  if (!isOrgAdmin(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can close the organization.' })
  }

  const body = await readBody<CloseOrganizationBody>(event)
  const confirmName = String(body?.confirmName ?? '').trim()
  if (!confirmName) {
    throw createError({ statusCode: 400, statusMessage: 'Organization name confirmation is required.' })
  }

  assertRateLimit(event, `close-organization:user:${user.id}`, { max: 5, windowMs: 60 * 60_000 })

  const organizationId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)

  let stripe = null
  try {
    stripe = requireStripeClient(event)
  } catch {
    // Free / enterprise orgs may close without Stripe configured
  }

  try {
    const result = await closeOrganization(pb, stripe, {
      organizationId,
      actorId: user.id,
      confirmName,
      event
    })

    const emailResult = await notifyOrgClosureEmails(event, organizationId)

    return {
      ...result,
      emailsSent: emailResult.sent,
      emailError: emailResult.error
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not close organization.'
    const statusCode = /does not match|already closing/i.test(message) ? 400 : 502
    throw createError({ statusCode, statusMessage: message })
  }
})
