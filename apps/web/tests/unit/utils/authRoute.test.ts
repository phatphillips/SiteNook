import { describe, expect, it } from 'vitest'
import {
  buildLoginNavigation,
  isProtectedAppRoute,
  loginRedirectTarget
} from '~/utils/authRoute'

describe('authRoute', () => {
  it('detects protected dashboard paths', () => {
    expect(isProtectedAppRoute('/sites/abc/accessibility/issues')).toBe(true)
    expect(isProtectedAppRoute('/settings/billing')).toBe(true)
    expect(isProtectedAppRoute('/scans')).toBe(true)
    expect(isProtectedAppRoute('/policies')).toBe(true)
    expect(isProtectedAppRoute('/accessibility/issues')).toBe(true)
    expect(isProtectedAppRoute('/qa/links')).toBe(true)
    expect(isProtectedAppRoute('/seo/technical')).toBe(true)
    expect(isProtectedAppRoute('/content/explorer')).toBe(true)
    expect(isProtectedAppRoute('/reports')).toBe(true)
  })

  it('does not treat guest or marketing paths as protected', () => {
    expect(isProtectedAppRoute('/login')).toBe(false)
    expect(isProtectedAppRoute('/pricing')).toBe(false)
    expect(isProtectedAppRoute('/')).toBe(false)
    expect(isProtectedAppRoute('/product/accessibility')).toBe(false)
    expect(isProtectedAppRoute('/help')).toBe(false)
  })

  it('preserves deep-link redirect query', () => {
    const target = '/sites/053vb11mlpygiv3/accessibility/issues?tab=open'
    expect(loginRedirectTarget({ path: target, fullPath: target })).toBe(target)
    expect(buildLoginNavigation({ path: target, fullPath: target })).toEqual({
      path: '/login',
      query: { redirect: target },
      replace: true
    })
  })
})
