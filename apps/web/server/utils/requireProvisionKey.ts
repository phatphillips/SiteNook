import { createError, getHeader, type H3Event } from 'h3'

function extractBearerToken(header: string | undefined): string | null {
  const value = header?.trim()
  if (!value) return null
  return value.replace(/^Bearer\s+/i, '').trim() || null
}

/** Validates the shared secret for server-to-server org provisioning. */
export function requireProvisionApiKey(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const expected = config.provisionApiKey?.trim()

  if (!expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Provisioning API is not configured (set NUXT_PROVISION_API_KEY)'
    })
  }

  const provided = getHeader(event, 'x-provision-key')?.trim()
    || extractBearerToken(getHeader(event, 'authorization'))

  if (!provided || provided !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid provisioning credentials'
    })
  }
}
