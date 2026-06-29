import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  assertSelfServiceSignupEnabled(event)
  assertApexHostForSelfService(event)

  const slug = String(getQuery(event).slug ?? '').trim()
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug query parameter is required' })
  }

  const ip = getClientIp(event)
  assertRateLimit(event, `subdomain-available:${ip}`, { max: 60, windowMs: 60_000 })

  const validationError = validateSubdomain(slug)
  if (validationError) {
    return { available: false, reason: validationError }
  }

  const pb = await getPbAdmin(event)
  return checkSubdomainAvailability(pb, slug)
})
