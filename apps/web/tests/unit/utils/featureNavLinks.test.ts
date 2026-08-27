import { describe, expect, it } from 'vitest'
import { buildOrgFeatureNavLinks, buildSiteFeatureNavLinks } from '~/utils/featureNavLinks'

describe('featureNavLinks', () => {
  it('does not nest Content under feature nav (Content is top-level in the layout)', () => {
    const siteNav = buildSiteFeatureNavLinks('site-1', '/sites/site-1/accessibility', () => {})
    expect(siteNav.find(item => item.label === 'Content')).toBeUndefined()

    const orgNav = buildOrgFeatureNavLinks('/accessibility', () => {})
    expect(orgNav.find(item => item.label === 'Content')).toBeUndefined()
  })

  it('includes Policies under QA for site and org nav', () => {
    const siteNav = buildSiteFeatureNavLinks('site-1', '/sites/site-1/qa/policies', () => {})
    const qaSite = siteNav.find(item => item.label === 'Quality Assurance')
    const siteChildren = (qaSite?.children ?? []).map(child => child.label)
    expect(siteChildren).toContain('Policies')
    expect(qaSite?.children?.find(c => c.label === 'Policies')?.to).toBe('/sites/site-1/qa/policies')

    const orgNav = buildOrgFeatureNavLinks('/qa/policies', () => {})
    const qaOrg = orgNav.find(item => item.label === 'Quality Assurance')
    expect(qaOrg?.children?.find(c => c.label === 'Policies')?.to).toBe('/qa/policies')
  })

  it('includes Simulator under Accessibility after Issues', () => {
    const siteNav = buildSiteFeatureNavLinks('site-1', '/sites/site-1/accessibility/simulator', () => {})
    const a11ySite = siteNav.find(item => item.label === 'Accessibility')
    const siteLabels = (a11ySite?.children ?? []).map(child => child.label)
    expect(siteLabels).toContain('Simulator')
    expect(siteLabels.indexOf('Simulator')).toBeGreaterThan(siteLabels.indexOf('Issues'))
    expect(a11ySite?.children?.find(c => c.label === 'Simulator')?.to)
      .toBe('/sites/site-1/accessibility/simulator')

    const orgNav = buildOrgFeatureNavLinks('/accessibility/simulator', () => {})
    const a11yOrg = orgNav.find(item => item.label === 'Accessibility')
    expect(a11yOrg?.children?.find(c => c.label === 'Simulator')?.to).toBe('/accessibility/simulator')
  })
})
