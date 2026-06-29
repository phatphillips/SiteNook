import { createError, getRequestHost, type H3Event } from 'h3'
import { parseHostSubdomain } from '~/utils/subdomain'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

export function assertSelfServiceSignupEnabled(event: H3Event): void {
  const config = useRuntimeConfig(event)
  if (!parseSelfServiceSignupFlag(config.public.selfServiceSignup)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
}

export function assertApexHostForSelfService(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const host = getRequestHost(event, { xForwardedHost: true })
  const parsed = parseHostSubdomain(host, config.public.appDomain)
  if (!parsed.isApex) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Self-service signup is only available on the main site.'
    })
  }
}
