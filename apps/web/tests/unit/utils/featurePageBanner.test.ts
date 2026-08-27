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

  it('returns contextual copy for feature overview routes', () => {
    expect(resolveFeaturePageBanner('/accessibility')?.title).toContain('accessibility health')
    expect(resolveFeaturePageBanner('/sites/abc/qa')?.title).toContain('quality')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility')).toBe('accessibility-overview')
    expect(resolveFeaturePageBannerKey('/qa')).toBe('qa-overview')
    expect(resolveFeaturePageBannerKey('/seo')).toBe('seo-overview')
    expect(resolveFeaturePageBanner('/sites/abc/seo')?.title).toContain('search visibility')
  })

  it('returns contextual copy for detail routes', () => {
    expect(resolveFeaturePageBanner('/accessibility/issues')?.title).toContain('Prioritize fixes')
    expect(resolveFeaturePageBanner('/accessibility/readability')?.title).toContain('readable')
    expect(resolveFeaturePageBanner('/sites/abc/accessibility/readability')?.title).toContain('readable')
    expect(resolveFeaturePageBanner('/sites/abc/qa/spelling')?.title).toContain('spelling')
    expect(resolveFeaturePageBanner('/qa/policies')?.title).toContain('policy matches')
    expect(resolveFeaturePageBannerKey('/sites/abc/qa/policies')).toBe('qa-policies')
    expect(resolveFeaturePageBanner('/sites/abc/seo/preview')?.title).toContain('Preview')
    expect(resolveFeaturePageBanner('/policies')?.title).toContain('policies')
    expect(resolveFeaturePageBanner('/reports')?.title).toContain('Export')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/pdfs')).toBe('accessibility-pdfs')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/pdfs/doc-1')).toBe('accessibility-pdf-inspector')
    expect(resolveFeaturePageBanner('/accessibility/pdfs/doc-1')?.title).toContain('Inspect')
    expect(resolveFeaturePageBannerKey('/accessibility/simulator')).toBe('accessibility-simulator')
    expect(resolveFeaturePageBannerKey('/sites/abc/accessibility/simulator/page-1')).toBe('accessibility-simulator-detail')
    expect(resolveFeaturePageBanner('/accessibility/simulator')?.title).toContain('abilities')
    expect(resolveFeaturePageBanner('/sites/abc/accessibility/simulator/page-1')?.title).toContain('Simulate')
    expect(resolveFeaturePageBannerKey('/content/explorer')).toBe('content-explorer')
    expect(resolveFeaturePageBannerKey('/sites/abc/content/explorer')).toBe('content-explorer')
    expect(resolveFeaturePageBanner('/content/explorer')?.title).toContain('Markdown')
  })
})
