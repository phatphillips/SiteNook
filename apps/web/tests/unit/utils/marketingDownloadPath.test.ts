import { describe, expect, it } from 'vitest'
import { isMarketingApexPath, MARKETING_APEX_EXACT_PATHS } from '~/utils/marketingSite'

describe('marketing download path', () => {
  it('includes /download as a public marketing path', () => {
    expect(MARKETING_APEX_EXACT_PATHS.has('/download')).toBe(true)
    expect(isMarketingApexPath('/download')).toBe(true)
  })
})
