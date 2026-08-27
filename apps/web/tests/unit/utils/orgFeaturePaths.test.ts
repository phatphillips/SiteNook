import { describe, expect, it } from 'vitest'
import { dashboardOrgSectionViewPath } from '~/utils/dashboardSectionOrder'
import {
  isOrgFeaturePath,
  orgFeaturePathFromSite,
  siteFeaturePathFromOrg
} from '~/utils/orgFeaturePaths'
import { isOverviewPath, isRootOverviewPath } from '~/utils/featureNavLinks'
import { paginateMerged } from '../../../server/utils/orgSites'

describe('orgFeaturePaths', () => {
  it('detects org feature paths', () => {
    expect(isOrgFeaturePath('/accessibility')).toBe(true)
    expect(isOrgFeaturePath('/accessibility/issues')).toBe(true)
    expect(isOrgFeaturePath('/content')).toBe(true)
    expect(isOrgFeaturePath('/content/explorer')).toBe(true)
    expect(isOrgFeaturePath('/qa/links')).toBe(true)
    expect(isOrgFeaturePath('/seo')).toBe(true)
    expect(isOrgFeaturePath('/sites/abc/qa')).toBe(false)
    expect(isOrgFeaturePath('/')).toBe(false)
  })

  it('maps between site and org feature paths', () => {
    expect(orgFeaturePathFromSite('/sites/site-1/accessibility/issues')).toBe('/accessibility/issues')
    expect(siteFeaturePathFromOrg('/qa/spelling', 'site-2')).toBe('/sites/site-2/qa/spelling')
    expect(siteFeaturePathFromOrg('/qa/policies', 'site-2')).toBe('/sites/site-2/qa/policies')
    expect(orgFeaturePathFromSite('/sites/site-1/qa/policies')).toBe('/qa/policies')
    expect(orgFeaturePathFromSite('/sites/site-1/content/explorer')).toBe('/content/explorer')
    expect(siteFeaturePathFromOrg('/content/explorer', 'site-2')).toBe('/sites/site-2/content/explorer')
  })

  it('keeps PDF document studio on the site path (no org detail route)', () => {
    expect(orgFeaturePathFromSite('/sites/site-1/accessibility/pdfs/doc-abc')).toBeNull()
    expect(orgFeaturePathFromSite('/sites/site-1/accessibility/pdfs/doc-abc?mode=structure')).toBeNull()
    expect(orgFeaturePathFromSite('/sites/site-1/accessibility/pdfs')).toBe('/accessibility/pdfs')
  })
})

describe('dashboardOrgSectionViewPath', () => {
  it('returns org overview routes', () => {
    expect(dashboardOrgSectionViewPath('accessibility')).toBe('/accessibility')
    expect(dashboardOrgSectionViewPath('qa')).toBe('/qa')
    expect(dashboardOrgSectionViewPath('seo')).toBe('/seo')
  })
})

describe('isRootOverviewPath', () => {
  it('matches only the root dashboard overview routes', () => {
    expect(isRootOverviewPath('/')).toBe(true)
    expect(isRootOverviewPath('/sites/abc')).toBe(true)
    expect(isRootOverviewPath('/accessibility')).toBe(false)
    expect(isRootOverviewPath('/qa')).toBe(false)
    expect(isRootOverviewPath('/sites/abc/qa')).toBe(false)
  })
})

describe('isOverviewPath', () => {
  it('matches home, site root, and feature overview routes', () => {
    expect(isOverviewPath('/')).toBe(true)
    expect(isOverviewPath('/accessibility')).toBe(true)
    expect(isOverviewPath('/qa')).toBe(true)
    expect(isOverviewPath('/sites/abc')).toBe(true)
    expect(isOverviewPath('/sites/abc/qa')).toBe(true)
    expect(isOverviewPath('/accessibility/issues')).toBe(false)
  })
})

describe('paginateMerged', () => {
  it('slices merged items by page', () => {
    const items = [1, 2, 3, 4, 5]
    expect(paginateMerged(items, 1, 2)).toEqual({
      items: [1, 2],
      total: 5,
      page: 1,
      perPage: 2
    })
    expect(paginateMerged(items, 2, 2).items).toEqual([3, 4])
  })
})
