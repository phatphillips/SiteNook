import { createError, getQuery } from 'h3'
import { isValidOrgLoginEmail, resolveOrgLoginRedirect } from '../utils/orgLoginUrl'

export default defineEventHandler(async (event) => {
  const email = String(getQuery(event).email ?? '').trim().toLowerCase()
  if (!isValidOrgLoginEmail(email)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email address is required.' })
  }

  const ip = getClientIp(event)
  assertRateLimit(event, `org-login-url:ip:${ip}`, { max: 30, windowMs: 60 * 60_000 })

  const config = useRuntimeConfig(event)
  const pb = await getPbAdmin(event)

  return resolveOrgLoginRedirect(pb, email, {
    appUrl: config.public.appUrl,
    appDomain: config.public.appDomain
  })
})
