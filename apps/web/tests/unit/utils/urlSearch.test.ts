import { describe, expect, it } from 'vitest'
import {
  findUrlMatchIndex,
  isUrlLikeQuery,
  typesenseTokenForUrlQuery,
  urlQueryMatchesInText,
  urlSearchVariants
} from '../../../app/utils/urlSearch'

describe('urlSearch', () => {
  it('detects URL-like queries', () => {
    expect(isUrlLikeQuery('http://www.decyp.tas.gov.au')).toBe(true)
    expect(isUrlLikeQuery('decyp.tas.gov.au')).toBe(true)
    expect(isUrlLikeQuery('hello world')).toBe(false)
  })

  it('builds hostname variants without protocol', () => {
    const variants = urlSearchVariants('http://www.decyp.tas.gov.au/page')
    expect(variants).toContain('www.decyp.tas.gov.au')
    expect(variants).toContain('decyp.tas.gov.au')
  })

  it('uses parent domain when TLD looks truncated', () => {
    expect(typesenseTokenForUrlQuery('http://www.decyp.tas.gov.a')).toBe('decyp.tas.gov')
  })

  it('keeps full hostname for complete ccTLD domains', () => {
    expect(typesenseTokenForUrlQuery('decyp.tas.gov.au')).toBe('decyp.tas.gov.au')
  })

  it('matches PDF plain-text links without http prefix', () => {
    const pdfText = 'Contact us at www.decyp.tas.gov.au for support'
    expect(urlQueryMatchesInText('http://www.decyp.tas.gov.au', pdfText)).toBe(true)
    expect(urlQueryMatchesInText('http://www.decyp.tas.gov.a', pdfText)).toBe(true)
    expect(findUrlMatchIndex('http://www.decyp.tas.gov.au', pdfText)).toBeGreaterThanOrEqual(0)
  })
})
