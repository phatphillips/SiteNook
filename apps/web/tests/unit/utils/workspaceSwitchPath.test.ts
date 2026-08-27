import { describe, expect, it } from 'vitest'
import {
  isWorkspaceNeutralPath,
  pathAfterSelectAllSites,
  pathAfterSelectSite
} from '~/utils/workspaceSwitchPath'

describe('workspaceSwitchPath', () => {
  describe('isWorkspaceNeutralPath', () => {
    it('matches global workspace pages', () => {
      expect(isWorkspaceNeutralPath('/')).toBe(true)
      expect(isWorkspaceNeutralPath('/sites')).toBe(true)
      expect(isWorkspaceNeutralPath('/search')).toBe(true)
      expect(isWorkspaceNeutralPath('/scans')).toBe(true)
      expect(isWorkspaceNeutralPath('/reports')).toBe(true)
      expect(isWorkspaceNeutralPath('/policies')).toBe(true)
      expect(isWorkspaceNeutralPath('/settings/billing')).toBe(true)
      expect(isWorkspaceNeutralPath('/sites/abc/qa')).toBe(false)
      expect(isWorkspaceNeutralPath('/qa')).toBe(false)
    })
  })

  describe('pathAfterSelectSite', () => {
    it('stays on neutral pages', () => {
      expect(pathAfterSelectSite('/search', 'site-2')).toBeNull()
      expect(pathAfterSelectSite('/scans', 'site-2')).toBeNull()
      expect(pathAfterSelectSite('/policies', 'site-2')).toBeNull()
    })

    it('swaps site id on site-scoped routes', () => {
      expect(pathAfterSelectSite('/sites/site-1/qa/links', 'site-2')).toBe('/sites/site-2/qa/links')
      expect(pathAfterSelectSite('/sites/site-1', 'site-2')).toBe('/sites/site-2')
    })

    it('maps org feature routes to site routes', () => {
      expect(pathAfterSelectSite('/qa/spelling', 'site-2')).toBe('/sites/site-2/qa/spelling')
      expect(pathAfterSelectSite('/qa/policies', 'site-2')).toBe('/sites/site-2/qa/policies')
    })
  })

  describe('pathAfterSelectAllSites', () => {
    it('stays on neutral pages', () => {
      expect(pathAfterSelectAllSites('/search')).toBeNull()
      expect(pathAfterSelectAllSites('/reports')).toBeNull()
    })

    it('maps site feature routes to org routes', () => {
      expect(pathAfterSelectAllSites('/sites/site-1/qa/spelling')).toBe('/qa/spelling')
      expect(pathAfterSelectAllSites('/sites/site-1/qa/policies')).toBe('/qa/policies')
    })

    it('maps site overview to home', () => {
      expect(pathAfterSelectAllSites('/sites/site-1')).toBe('/')
    })
  })
})
