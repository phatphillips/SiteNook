import type { RouteLocationNormalized } from 'vue-router'
import { GUEST_AUTH_PATHS } from '~/utils/pbAuth'

/**
 * App sections that require a signed-in PocketBase user.
 * Keep in sync with dashboard nav / pages that use `middleware: 'auth'`.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  '/sites',
  '/search',
  '/settings',
  '/scans',
  '/policies',
  '/accessibility',
  '/qa',
  '/seo',
  '/content',
  '/reports'
] as const

export function isProtectedAppRoute(path: string): boolean {
  if (!path || path === '/') return false
  if (GUEST_AUTH_PATHS.has(path)) return false
  return PROTECTED_ROUTE_PREFIXES.some(prefix =>
    path === prefix || path.startsWith(`${prefix}/`)
  )
}

export function loginRedirectTarget(to: Pick<RouteLocationNormalized, 'fullPath' | 'path'>): string {
  return to.fullPath || to.path || '/'
}

export function buildLoginNavigation(
  to: Pick<RouteLocationNormalized, 'fullPath' | 'path'>,
  extraQuery?: Record<string, string>
) {
  return {
    path: '/login' as const,
    query: {
      redirect: loginRedirectTarget(to),
      ...extraQuery
    },
    replace: true as const
  }
}
