import { getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  assertSelfServiceSignupEnabled(event)
  assertApexHostForSelfService(event)

  const ip = getClientIp(event)
  assertRateLimit(event, `start-access:ip:${ip}`, { max: 60, windowMs: 60 * 60_000 })

  const query = getQuery(event)
  return resolveStartAccess(event, {
    plan: query.plan,
    checkout: query.checkout,
    trial: query.trial
  })
})
