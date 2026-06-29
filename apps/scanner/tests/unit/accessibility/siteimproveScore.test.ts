import { describe, expect, it } from 'vitest'
import {
  calculateQaScore,
  calculateSiteimproveScores,
  countElementsFromHtmlSnapshots,
  logarithmicProgress,
  pointsToGainForRule,
  pointsToGainIfAllResolvedForRule
} from '../../../src/accessibility/siteimproveScore.js'

describe('siteimproveScore', () => {
  it('returns perfect scores when there are no open issues', () => {
    expect(calculateSiteimproveScores([], {
      image: 0, link: 0, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0
    })).toEqual({
      overall: 100,
      levelA: 100,
      levelAA: 100,
      levelAAA: 100
    })
  })

  it('overall reflects clean levels at full weight when only one level fails', () => {
    const issues = Array.from({ length: 18 }, () => ({
      rule_id: 'link-name',
      wcag_level: 'AA' as const,
      element_type: 'link',
      status: 'open'
    }))
    const totals = {
      image: 0, link: 100, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0
    }
    const scores = calculateSiteimproveScores(issues, totals)

    expect(scores.levelA).toBe(100)
    expect(scores.levelAAA).toBe(100)
    expect(scores.levelAA).toBeGreaterThan(55)
    expect(scores.levelAA).toBeLessThan(62)
    expect(scores.overall).toBeGreaterThan(scores.levelAA + 25)
    expect(scores.overall).toBeGreaterThanOrEqual(85)
    expect(scores.overall).toBeLessThanOrEqual(96)
  })

  it('uses element denominators so image-alt failures are ratio-based', () => {
    const scores = calculateSiteimproveScores(
      [
        { rule_id: 'image-alt', wcag_level: 'A', element_type: 'image', status: 'open' },
        { rule_id: 'image-alt', wcag_level: 'A', element_type: 'image', status: 'open' }
      ],
      {
        image: 100,
        link: 0,
        form: 0,
        heading: 0,
        table: 0,
        media: 0,
        aria: 0,
        other: 0
      }
    )
    expect(scores.overall).toBeGreaterThan(50)
    expect(scores.overall).toBeLessThan(100)
    expect(scores.levelA).toBeLessThan(100)
  })

  it('counts elements from HTML snapshots', () => {
    const totals = countElementsFromHtmlSnapshots([
      { htmlSnapshot: '<img src="a.jpg"><a href="/">x</a><h1>Hi</h1>' }
    ])
    expect(totals.image).toBe(1)
    expect(totals.link).toBe(1)
    expect(totals.heading).toBe(1)
  })

  it('sums element counts across pages when depth weighting is off', () => {
    const totals = countElementsFromHtmlSnapshots([
      { htmlSnapshot: '<a href="/">x</a>' },
      { htmlSnapshot: '<a href="/b">y</a><a href="/c">z</a>' }
    ])
    expect(totals.link).toBe(3)
  })

  it('increases logarithmic progress near completion', () => {
    const low = logarithmicProgress(0.5)
    const high = logarithmicProgress(0.95) - logarithmicProgress(0.9)
    const mid = logarithmicProgress(0.55) - logarithmicProgress(0.5)
    expect(high).toBeGreaterThan(mid)
    expect(low).toBeGreaterThan(0)
    expect(low).toBeLessThan(0.5)
  })

  it('awards positive points to gain when fixing a rule occurrence', () => {
    const issues = [
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' }
    ]
    const totals = {
      image: 0, link: 0, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0
    }
    const gain = pointsToGainForRule(issues, totals, 'color-contrast')
    expect(gain).toBeGreaterThan(0)
  })

  it('awards more for resolving all occurrences than one', () => {
    const issues = [
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' },
      { rule_id: 'color-contrast', wcag_level: 'AA' as const, status: 'open' }
    ]
    const totals = {
      image: 0, link: 0, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0
    }
    const one = pointsToGainForRule(issues, totals, 'color-contrast')
    const all = pointsToGainIfAllResolvedForRule(issues, totals, 'color-contrast')
    expect(all).toBeGreaterThan(one)
  })

  it('calculates ratio-based QA scores', () => {
    expect(calculateQaScore(0, 50, 0, 500)).toBe(100)
    expect(calculateQaScore(5, 50, 10, 500)).toBeLessThan(100)
  })
})
