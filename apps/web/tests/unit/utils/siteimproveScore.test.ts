import { describe, expect, it } from 'vitest'
import {
  calculateQaScore,
  calculateSiteimproveScores,
  calculateTargetCategoryScores,
  countQaDenominatorsFromPages,
  estimateElementTotalsFromIssues,
  overallScoreBreakdown,
  pointsToGainForRule,
  pointsToGainIfAllResolvedForRule,
  resolveElementTotals,
  scoreRingColor
} from '~/utils/siteimproveScore'

describe('siteimproveScore (web)', () => {
  it('estimates element totals from open issues', () => {
    const totals = estimateElementTotalsFromIssues([
      { rule_id: 'image-alt', wcag_level: 'A', element_type: 'image', status: 'open' },
      { rule_id: 'image-alt', wcag_level: 'A', element_type: 'image', status: 'open' }
    ])
    expect(totals.image).toBeGreaterThanOrEqual(4)
  })

  it('prefers cached element denominators over estimates', () => {
    const cached = {
      image: 100,
      link: 50,
      form: 0,
      heading: 10,
      table: 0,
      media: 0,
      aria: 0,
      other: 0
    }
    const resolved = resolveElementTotals(cached, [])
    expect(resolved.image).toBe(100)
    expect(resolved.link).toBe(50)
  })

  it('counts dismissed issues toward totals but not failures', () => {
    const totals = estimateElementTotalsFromIssues([
      { rule_id: 'color-contrast', wcag_level: 'AA', status: 'open' }
    ])
    const openOnly = calculateSiteimproveScores(
      [{ rule_id: 'color-contrast', wcag_level: 'AA', status: 'open' }],
      totals
    )
    const withDismissed = calculateSiteimproveScores(
      [
        { rule_id: 'color-contrast', wcag_level: 'AA', status: 'open' },
        { rule_id: 'color-contrast', wcag_level: 'AA', status: 'dismissed' }
      ],
      totals
    )
    expect(withDismissed.overall).toBeGreaterThan(openOnly.overall)
  })

  it('keeps overall high when only one AA rule fails in the catalog', () => {
    const issues = Array.from({ length: 18 }, () => ({
      rule_id: 'link-name',
      wcag_level: 'AA' as const,
      element_type: 'link',
      status: 'open'
    }))
    const totals = {
      image: 0,
      link: 100,
      form: 0,
      heading: 0,
      table: 0,
      media: 0,
      aria: 0,
      other: 0
    }
    const scores = calculateSiteimproveScores(issues, totals)

    expect(scores.levelA).toBe(100)
    expect(scores.levelAAA).toBe(100)
    expect(scores.levelAA).toBeGreaterThan(85)
    expect(scores.overall).toBeGreaterThan(90)
  })

  it('does not collapse AA when scan catalog only lists failing rules', () => {
    const issues = Array.from({ length: 40 }, () => ({
      rule_id: 'color-contrast',
      wcag_level: 'AA' as const,
      status: 'open'
    }))
    const totals = {
      image: 0, link: 0, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0
    }
    const shortCatalogStats = {
      catalog: [{ rule_id: 'color-contrast', wcag_level: 'AA' as const, is_best_practice: false }],
      rules: { 'color-contrast': { failed: 40, passed: 0, incomplete: 0 } }
    }
    const scores = calculateSiteimproveScores(issues, totals, shortCatalogStats)
    expect(scores.levelAA).toBeGreaterThan(80)
    expect(scores.overall).toBeGreaterThan(85)
    const gain = pointsToGainIfAllResolvedForRule(issues, totals, 'color-contrast', shortCatalogStats)
    expect(gain).toBeLessThan(5)
  })

  it('produces level scores separate from overall', () => {
    const scoreIssues = [
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'image-alt', wcag_level: 'A' as const, element_type: 'image', status: 'open' }
    ]
    const scores = calculateSiteimproveScores(
      scoreIssues,
      estimateElementTotalsFromIssues(scoreIssues)
    )
    expect(scores.levelA).toBeLessThan(100)
    expect(scores.levelAA).toBeLessThan(100)
    expect(scores.overall).toBeLessThan(100)
  })

  it('calculates QA score from link and spelling ratios', () => {
    const score = calculateQaScore(2, 100, 5, 1000)
    expect(score).toBeGreaterThan(50)
    expect(score).toBeLessThan(100)
    expect(calculateQaScore(0, 100, 0, 1000)).toBe(100)
  })

  it('weights broken links more heavily than spelling in QA score', () => {
    const linkHeavy = calculateQaScore(10, 100, 0, 1000)
    const spellHeavy = calculateQaScore(0, 100, 10, 1000)
    expect(linkHeavy).toBeLessThan(spellHeavy)
  })

  it('awards more points to gain for resolving all rule occurrences than one', () => {
    const issues = [
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' }
    ]
    const totals = estimateElementTotalsFromIssues(issues)
    const one = pointsToGainForRule(issues, totals, 'color-contrast')
    const all = pointsToGainIfAllResolvedForRule(issues, totals, 'color-contrast')
    expect(all).toBeGreaterThan(one)
  })

  it('maps score ring colours to 0–49 / 50–74 / 75–100 thresholds', () => {
    expect(scoreRingColor(40.8)).toBe('#ef4444')
    expect(scoreRingColor(49)).toBe('#ef4444')
    expect(scoreRingColor(50)).toBe('#f59e0b')
    expect(scoreRingColor(61.7)).toBe('#f59e0b')
    expect(scoreRingColor(74)).toBe('#f59e0b')
    expect(scoreRingColor(75)).toBe('#22c55e')
    expect(scoreRingColor(72.4)).toBe('#f59e0b')
  })

  it('overallScoreBreakdown matches calculateSiteimproveScores overall', () => {
    const scoreIssues = [
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'image-alt', wcag_level: 'A' as const, element_type: 'image', status: 'open' }
    ]
    const totals = estimateElementTotalsFromIssues(scoreIssues)
    const scores = calculateSiteimproveScores(scoreIssues, totals)
    const breakdown = overallScoreBreakdown(scoreIssues, totals)

    expect(breakdown).not.toBeNull()
    expect(breakdown!.overall).toBe(scores.overall)
    expect(breakdown!.wcagEarned + breakdown!.bpEarnedAdjusted).toBe(scores.overall)
    expect(breakdown!.levels.reduce((sum, level) => sum + level.earned, 0)).toBe(breakdown!.wcagEarned)
  })

  it('returns 100 for best practices when no best-practice checks ran', () => {
    const issues = [{
      rule_id: 'link-name',
      wcag_level: 'AA' as const,
      element_type: 'link',
      status: 'open'
    }]
    const totals = {
      image: 0,
      link: 10,
      form: 0,
      heading: 0,
      table: 0,
      media: 0,
      aria: 0,
      other: 0
    }
    const categories = calculateTargetCategoryScores(issues, totals)
    expect(categories.bestPractice).toBe(100)
  })
})
