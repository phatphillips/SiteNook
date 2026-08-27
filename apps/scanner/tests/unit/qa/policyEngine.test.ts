import { describe, expect, it } from 'vitest'
import {
  axeExcludeSelectorsFromPolicies,
  parseCssExcludeSelectors,
  runPolicies,
  type Policy
} from '../../../src/qa/policyEngine.js'

function policy(overrides: Partial<Policy> & Pick<Policy, 'id' | 'rule_type' | 'pattern'>): Policy {
  return {
    name: overrides.name ?? overrides.id,
    kind: overrides.kind ?? 'flag_content',
    category: overrides.category ?? 'qa',
    severity: overrides.severity ?? 'warning',
    enabled: overrides.enabled ?? true,
    ...overrides
  }
}

describe('runPolicies', () => {
  it('returns empty for empty or all-disabled policies', () => {
    expect(runPolicies('<p>hello</p>', [])).toEqual([])
    expect(runPolicies('<p>hello</p>', [
      policy({ id: 'p1', rule_type: 'keyword', pattern: 'hello', enabled: false })
    ])).toEqual([])
  })

  it('matches keyword case-insensitively and records status open', () => {
    const html = 'Prefix HELLO world suffix with more text around the keyword.'
    const matches = runPolicies(html, [
      policy({ id: 'kw', rule_type: 'keyword', pattern: 'hello' })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      policy: 'kw',
      matched_text: 'hello',
      status: 'open'
    })
    expect(matches[0]!.context.toLowerCase()).toContain('hello')
  })

  it('returns empty when keyword is absent', () => {
    expect(runPolicies('<p>nothing here</p>', [
      policy({ id: 'kw', rule_type: 'keyword', pattern: 'missing' })
    ])).toEqual([])
  })

  it('records only the first keyword occurrence', () => {
    const html = 'foo TARGET mid TARGET end'
    const matches = runPolicies(html, [
      policy({ id: 'kw', rule_type: 'keyword', pattern: 'TARGET' })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.context).toContain('foo TARGET mid')
  })

  it('returns all regex matches with gi', () => {
    const html = 'aa bb aa cc aa'
    const matches = runPolicies(html, [
      policy({ id: 'rx', rule_type: 'regex', pattern: 'aa' })
    ])
    expect(matches).toHaveLength(3)
    expect(matches.every(m => m.matched_text === 'aa' && m.policy === 'rx')).toBe(true)
  })

  it('skips invalid regex without throwing and still runs other policies', () => {
    const html = 'safe keyword here'
    const matches = runPolicies(html, [
      policy({ id: 'bad', rule_type: 'regex', pattern: '[invalid' }),
      policy({ id: 'ok', rule_type: 'keyword', pattern: 'keyword' })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.policy).toBe('ok')
  })

  it('matches html_attribute patterns', () => {
    const html = '<img src="x.png" onclick="alert(1)" alt="hi">'
    const matches = runPolicies(html, [
      policy({ id: 'attr', rule_type: 'html_attribute', pattern: 'onclick' })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.matched_text).toMatch(/onclick\s*=/i)
    expect(matches[0]!.context).toBe(matches[0]!.matched_text)
  })

  it('only evaluates enabled policies in a mixed list', () => {
    const html = 'alpha beta gamma'
    const matches = runPolicies(html, [
      policy({ id: 'off', rule_type: 'keyword', pattern: 'alpha', enabled: false }),
      policy({ id: 'on', rule_type: 'keyword', pattern: 'beta', enabled: true })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.policy).toBe('on')
  })

  it('does not create matches for exclude_from_accessibility policies', () => {
    const html = '<iframe src="https://www.youtube.com/embed/x"></iframe> hello'
    const matches = runPolicies(html, [
      policy({
        id: 'ex',
        kind: 'exclude_from_accessibility',
        rule_type: 'css_selector',
        pattern: 'iframe[src*="youtube.com"]'
      }),
      policy({ id: 'kw', rule_type: 'keyword', pattern: 'hello' })
    ])
    expect(matches).toHaveLength(1)
    expect(matches[0]!.policy).toBe('kw')
  })
})

describe('parseCssExcludeSelectors', () => {
  it('splits newlines and commas and dedupes', () => {
    expect(parseCssExcludeSelectors(
      'iframe[src*="youtube.com"]\niframe\niframe, iframe[src*="vimeo.com"]'
    )).toEqual([
      'iframe[src*="youtube.com"]',
      'iframe',
      'iframe[src*="vimeo.com"]'
    ])
  })

  it('returns empty for blank pattern', () => {
    expect(parseCssExcludeSelectors('  \n  ')).toEqual([])
  })
})

describe('axeExcludeSelectorsFromPolicies', () => {
  it('skips invalid CSS leftovers such as regex patterns', () => {
    expect(axeExcludeSelectorsFromPolicies([
      policy({
        id: 'bad',
        kind: 'exclude_from_accessibility',
        rule_type: 'css_selector',
        pattern: '<iframe\\b\niframe'
      })
    ])).toEqual(['iframe'])
  })

  it('collects selectors only from enabled exclude policies', () => {
    expect(axeExcludeSelectorsFromPolicies([
      policy({
        id: 'yt',
        kind: 'exclude_from_accessibility',
        rule_type: 'css_selector',
        pattern: 'iframe[src*="youtube.com"]\niframe[src*="youtube-nocookie.com"]'
      }),
      policy({
        id: 'off',
        kind: 'exclude_from_accessibility',
        rule_type: 'css_selector',
        pattern: 'iframe',
        enabled: false
      }),
      policy({ id: 'flag', rule_type: 'regex', pattern: '<iframe\\b' })
    ])).toEqual([
      'iframe[src*="youtube.com"]',
      'iframe[src*="youtube-nocookie.com"]'
    ])
  })
})
