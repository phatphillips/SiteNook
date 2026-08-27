import { describe, expect, it } from 'vitest'
import { pathToAlignWorkspaceWithRoute } from '~/utils/workspaceRouteSync'

describe('workspaceRouteSync', () => {
  it('keeps site-scoped PDF document studio in all-sites mode', () => {
    expect(
      pathToAlignWorkspaceWithRoute(
        '/sites/site-1/accessibility/pdfs/doc-abc',
        true,
        null
      )
    ).toBeNull()
  })

  it('maps site feature routes to org routes in all-sites mode', () => {
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/qa/links', true, null))
      .toBe('/qa/links')
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/qa/policies', true, null))
      .toBe('/qa/policies')
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/accessibility/readability', true, null))
      .toBe('/accessibility/readability')
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/accessibility/issues', true, null))
      .toBe('/accessibility/issues')
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/accessibility/pdfs', true, null))
      .toBe('/accessibility/pdfs')
  })

  it('maps org feature routes to site routes when a site is selected', () => {
    expect(pathToAlignWorkspaceWithRoute('/qa/spelling', false, 'site-2'))
      .toBe('/sites/site-2/qa/spelling')
    expect(pathToAlignWorkspaceWithRoute('/qa/policies', false, 'site-2'))
      .toBe('/sites/site-2/qa/policies')
    expect(pathToAlignWorkspaceWithRoute('/accessibility/issues', false, 'site-2'))
      .toBe('/sites/site-2/accessibility/issues')
  })

  it('returns null when route already matches workspace', () => {
    expect(pathToAlignWorkspaceWithRoute('/qa/links', true, null)).toBeNull()
    expect(pathToAlignWorkspaceWithRoute('/sites/site-1/qa/links', false, 'site-1')).toBeNull()
    expect(pathToAlignWorkspaceWithRoute('/search', true, null)).toBeNull()
  })
})
