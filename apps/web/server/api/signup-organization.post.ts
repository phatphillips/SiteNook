import { createError } from 'h3'
import { trackServerFunnelEvent } from '../utils/funnelAnalytics'

interface SignupOrganizationBody {
  orgName?: string
  subdomain?: string
  ownerName?: string
  ownerEmail?: string
  ownerPassword?: string
  turnstileToken?: string
  acceptTerms?: boolean
  plan?: string
  checkoutSessionId?: string
  trial?: boolean | string | number
}

export default defineEventHandler(async (event) => {
  assertSelfServiceSignupEnabled(event)
  assertApexHostForSelfService(event)

  const ip = getClientIp(event)
  assertRateLimit(event, `signup-organization:ip:${ip}`, { max: 10, windowMs: 60 * 60_000 })

  const body = await readBody<SignupOrganizationBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  const ownerEmail = String(body.ownerEmail ?? '').trim()
  const ownerPassword = String(body.ownerPassword ?? '')
  if (!ownerPassword || ownerPassword.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters.'
    })
  }

  if (ownerEmail) {
    assertRateLimit(
      event,
      `signup-organization:email:${ownerEmail.toLowerCase()}`,
      { max: 3, windowMs: 24 * 60 * 60_000 }
    )
  }

  if (body.acceptTerms !== true) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You must accept the terms to create an organization.'
    })
  }

  const config = useRuntimeConfig(event)
  const turnstileSecret = config.turnstileSecret?.trim()
  if (turnstileSecret) {
    const token = String(body.turnstileToken ?? '').trim()
    if (!token) {
      throw createError({ statusCode: 400, statusMessage: 'Captcha verification is required.' })
    }
    const verified = await verifyTurnstileToken(turnstileSecret, token, ip)
    if (!verified) {
      throw createError({ statusCode: 400, statusMessage: 'Captcha verification failed. Please try again.' })
    }
  }

  const { plan, checkoutSessionId, teamTrial } = await assertSignupPlanAuthorized(
    event,
    body.plan ?? 'free',
    body.checkoutSessionId,
    body.trial
  )

  const input = {
    orgName: String(body.orgName ?? ''),
    subdomain: String(body.subdomain ?? ''),
    ownerName: String(body.ownerName ?? ''),
    ownerEmail,
    ownerPassword,
    plan,
    teamTrial: teamTrial === true
  }

  const pb = await getPbAdmin(event)

  try {
    const result = await provisionOrganization(pb, input, {
      appDomain: config.public.appDomain,
      appUrl: config.public.appUrl,
      createdVia: 'self_service'
    })

    if (teamTrial) {
      trackServerFunnelEvent('trial_start', {
        organizationId: result.organization.id,
        plan: 'team',
        source: 'signup'
      })
    }

    if (checkoutSessionId?.startsWith('cs_')) {
      await markCheckoutSessionConsumed(pb, checkoutSessionId, result.organization.id)
    }

    setResponseStatus(event, 201)
    return result
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    const message = formatPbError(error)
    const statusCode = /already in use|reserved|must be|required|not valid|already registered|accept the terms|captcha|cannot be blank/i.test(message)
      ? 400
      : 502
    throw createError({ statusCode, statusMessage: message })
  }
})
