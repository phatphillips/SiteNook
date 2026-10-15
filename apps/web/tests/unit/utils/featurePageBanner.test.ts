import { describe, expect, it } from 'vitest'
import {
  normalizeFeatureDetailPath,
  resolveFeaturePageBanner,
  resolveFeaturePageBannerKey
} from '~/utils/featurePageBanner'

describe('featurePageBanner', () => {
  it('normalizes site feature paths to org-equivalent suffixes', () => {
    expect(normalizeFeatureDetailPath('/sites/abc/qa/links')).toBe('/qa/links')
    expect(normalizeFeatureDetailPath('/qa/spelling')).toBe('/qa/spelling')
    expect(normalizeFeatureDetailPath('/sites')).toBeNull()
  })

  it('returns description-only copy for feature overview routes', () => {
    expect(resolveFeaturePageBanner('/accessibility')?.description).toContain('target score')
    expect(resolveFeaturePageBanner('/sites/abc/qa')?.description).toContain('broken links')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility')).toBe('accessibility-overview')
    expect(resolveFeaturePageBannerKey('/qa')).toBe('qa-overview')
    expect(resolveFeaturePageBannerKey('/seo')).toBe('seo-overview')
    expect(resolveFeaturePageBanner('/sites/abc/seo')?.description).toContain('SEO scores')
  })

  it('returns description-only copy for detail routes', () => {
    expect(resolveFeaturePageBanner('/accessibility/issues')?.description).toContain('WCAG issues')
    expect(resolveFeaturePageBanner('/accessibility/readability')?.description).toContain('readability scores')
    expect(resolveFeaturePageBanner('/sites/abc/accessibility/readability')?.description).toContain('readability scores')
    expect(resolveFeaturePageBanner('/sites/abc/qa/spelling')?.description).toContain('misspellings')
    expect(resolveFeaturePageBanner('/qa/policies')?.description).toContain('custom rules')
    expect(resolveFeaturePageBannerKey('/sites/abc/qa/policies')).toBe('qa-policies')
    expect(resolveFeaturePageBanner('/sites/abc/seo/preview')?.description).toContain('title tags')
    expect(resolveFeaturePageBanner('/policies')?.description).toContain('keyword and pattern')
    expect(resolveFeaturePageBanner('/reports')?.description).toContain('Generate reports')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/pdfs')).toBe('accessibility-pdfs')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/pdfs/doc-1')).toBe('accessibility-pdf-inspector')
    expect(resolveFeaturePageBanner('/accessibility/pdfs/doc-1')?.description).toContain('veraPDF')
    expect(resolveFeaturePageBannerKey('/accessibility/simulator')).toBe('accessibility-simulator')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/simulator/page-1')).toBe('accessibility-simulator-detail')
    expect(resolveFeaturePageBanner('/accessibility/simulator')?.description).toContain('vision impairment')
    expect(resolveFeaturePageBanner('/sites/abc/accessibility/simulator/page-1')?.description).toContain('toolbar')
    expect(resolveFeaturePageBannerKey('/content/explorer')).toBeNull()
    expect(resolveFeaturePageBannerKey('/sites/abc/content/explorer')).toBeNull()
    expect(resolveFeaturePageBanner('/content/explorer')).toBeNull()
  })
})
