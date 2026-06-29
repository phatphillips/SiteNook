import { ClientResponseError } from 'pocketbase'
import type PocketBase from 'pocketbase'
import { buildTenantLoginUrl } from './provisioning'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidOrgLoginEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

export function buildSignInFallbackUrl(appUrl: string): string {
  const base = appUrl.replace(/\/$/, '')
  return `${base}/sign-in?status=unknown`
}

export function appendEmailToLoginUrl(loginUrl: string, email: string): string {
  const normalized = email.trim().toLowerCase()
  try {
    const url = new URL(loginUrl)
    url.searchParams.set('email', normalized)
    return url.toString()
  } catch {
    const separator = loginUrl.includes('?') ? '&' : '?'
    return `${loginUrl}${separator}email=${encodeURIComponent(normalized)}`
  }
}

export async function resolveOrgLoginRedirect(
  pb: PocketBase,
  email: string,
  options: { appUrl: string, appDomain: string }
): Promise<{ loginUrl: string }> {
  const fallbackUrl = buildSignInFallbackUrl(options.appUrl)
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const user = await pb.collection('users').getFirstListItem(
      `email = "${normalizedEmail.replace(/"/g, '\\"')}"`,
      { fields: 'id,organization' }
    )

    const orgId = typeof user.organization === 'string' ? user.organization : ''
    if (!orgId) {
      return { loginUrl: fallbackUrl }
    }

    const org = await pb.collection('organizations').getOne(orgId, { fields: 'subdomain,status' })
    if (String(org.status || '').trim() === 'closing') {
      return { loginUrl: fallbackUrl }
    }

    const subdomain = String(org.subdomain || '').trim().toLowerCase()
    if (!subdomain) {
      return { loginUrl: fallbackUrl }
    }

    const tenantLogin = buildTenantLoginUrl(
      subdomain,
      options.appDomain,
      options.appUrl
    )
    return { loginUrl: appendEmailToLoginUrl(tenantLogin, normalizedEmail) }
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return { loginUrl: fallbackUrl }
    }
    throw error
  }
}
