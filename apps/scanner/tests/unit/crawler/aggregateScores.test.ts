import { describe, expect, it } from 'vitest'
import {
  aggregateScores,
  scanScoreFieldsFromAggregate,
  type PageResult
} from '../../../src/crawler/siteCrawler.js'
import { emptyReadabilityScores } from '../../../src/qa/readabilityMethods.js'

function pageWithAaIssues(count: number, linksInHtml = 100): PageResult {
  const issues = Array.from({ length: count }, () => ({
    rule_id: 'link-name',
    wcag_level: 'AA',
    wcag_sc: '2.4.4',
    wcag_version: '2.2',
    impact: 'serious',
    type: 'error' as const,
    element_type: 'link',
    responsible_role: 'editor',
    description: 'Links must have discernible text',
    html_snippet: '<a href="/"></a>',
    css_selector: 'a',
    fix_suggestion: 'Add link text',
    status: 'open'
  }))

  return {
    url: 'https://example.com',
    title: 'Example',
    statusCode: 200,
    wordCount: 500,
    readabilityScore: 60,
    readabilityScores: emptyReadabilityScores(),
    crawlDepth: 0,
    htmlSnapshot: '<a href="/">link</a>'.repeat(linksInHtml),
    htmlSizeBytes: linksInHtml * 20,
    issues,
    brokenLinks: [],
    linkHrefs: [],
    spelling: [],
    inventory: []
  }
}

describe('aggregateScores', () => {
  it('writes consistent overall and level scores from the same issue set', () => {
    const result = aggregateScores([pageWithAaIssues(18)])

    expect(result.score_a).toBe(100)
    expect(result.score_aaa).toBe(100)
    expect(result.score_aa).toBeGreaterThan(85)
    expect(result.score_overall).toBeGreaterThan(90)
    expect(result.a11y_check_stats.catalog.length).toBeGreaterThan(0)
  })

  it('returns 100 for all levels when there are no issues', () => {
    const page = pageWithAaIssues(0)
    const result = aggregateScores([page])

    expect(result).toMatchObject({
      score_overall: 100,
      score_a: 100,
      score_aa: 100,
      score_aaa: 100,
      score_best_practices: 100
    })
  })

  it('estimates element denominators from issues when HTML snapshots are empty', () => {
    const page = {
      ...pageWithAaIssues(18),
      htmlSnapshot: ''
    }
    const result = aggregateScores([page])

    expect(result.score_aa).toBeLessThan(100)
    expect(result.score_aa).toBeGreaterThan(70)
    expect(result.score_aaa).toBe(100)
  })

  it('keeps level scores when re-aggregating from truncated HTML with cached denominators', () => {
    const fullPage = pageWithAaIssues(18, 100)
    const fullResult = aggregateScores([fullPage])

    const truncatedPage = {
      ...fullPage,
      htmlSnapshot: '<a href="/">link</a>'
    }
    const brokenResult = aggregateScores([truncatedPage])
    expect(brokenResult.score_aa).toBeLessThan(fullResult.score_aa)

    const fixedResult = aggregateScores([truncatedPage], {
      cachedDenominators: fullResult.score_denominators
    })
    expect(fixedResult.score_aa).toBe(fullResult.score_aa)
    expect(fixedResult.score_aaa).toBe(fullResult.score_aaa)
    expect(fixedResult.score_a).toBe(fullResult.score_a)
  })

  it('keeps level AA above zero on multi-page crawls without depth weighting', () => {
    const pages = [
      pageWithAaIssues(9, 50),
      { ...pageWithAaIssues(9, 50), url: 'https://example.com/about' }
    ]
    const result = aggregateScores(pages)

    expect(result.score_a).toBe(100)
    expect(result.score_aa).toBeGreaterThan(85)
    expect(result.score_overall).toBeGreaterThan(90)
  })

  it('maps all score fields for atomic PocketBase updates', () => {
    const result = aggregateScores([pageWithAaIssues(18)])
    const fields = scanScoreFieldsFromAggregate(result)

    expect(fields.score_overall).toBe(result.score_overall)
    expect(fields.score_a).toBe(result.score_a)
    expect(fields.score_aa).toBe(result.score_aa)
    expect(fields.score_aaa).toBe(result.score_aaa)
    expect(fields.score_best_practices).toBe(result.score_best_practices)
    expect(fields.score_qa).toBe(result.score_qa)
    expect(fields.score_denominators).toEqual(result.score_denominators)
    expect(Object.keys(fields).sort()).toEqual([
      'a11y_check_stats',
      'score_a',
      'score_aa',
      'score_aaa',
      'score_best_practices',
      'score_denominators',
      'score_overall',
      'score_qa'
    ])
  })
})
