import { createError, sendRedirect } from 'h3'

function readSafeTenant(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const tenant = value.trim().toLowerCase()
  if (!tenant || !/^[a-z0-9-]+$/.test(tenant)) return null
  return tenant
}

function readSafePath(value: unknown): string {
  if (typeof value !== 'string') return '/settings/billing'
  const path = value.trim()
  if (!path.startsWith('/')) return '/settings/billing'
  return path
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const tenant = readSafeTenant(query.tenant)
  if (!tenant) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tenant in Stripe return URL.' })
  }

  const path = readSafePath(query.path)
  const rawQuery = typeof query.query === 'string' ? query.query.trim() : ''
  const requestUrl = getRequestURL(event)
  const targetOrigin = `${requestUrl.protocol}//${tenant}.localhost${requestUrl.port ? `:${requestUrl.port}` : ''}`
  const target = `${targetOrigin}${path}${rawQuery ? `?${rawQuery}` : ''}`
  return sendRedirect(event, target, 302)
})
