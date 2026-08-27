import { describe, expect, it } from 'vitest'
import {
  buildReadabilityColumnLabels,
  coerceReadabilityMethods,
  DEFAULT_READABILITY_METHODS,
  getReadabilityScoreStatus,
  scoreToGaugePosition,
  averageGaugePosition,
  averageRawScore
} from '~/utils/readabilityMethods'
import { resolvePageReadabilityScores } from '~/utils/readabilityScoring'
import { buildReadabilityDistribution, bucketForScore } from '~/utils/readabilityDistribution'

describe('readabilityMethods utils', () => {
  it('defaults to Flesch-Kincaid Grade Level only', () => {
    expect(DEFAULT_READABILITY_METHODS).toEqual(['flesch_kincaid_grade'])
  })

  it('coerces to a single method', () => {
    expect(coerceReadabilityMethods(['ari', 'lix'])).toEqual(['ari'])
    expect(coerceReadabilityMethods(['ari', 'flesch_kincaid_grade'])).toEqual(['flesch_kincaid_grade'])
    expect(coerceReadabilityMethods(['invalid'])).toEqual(['flesch_kincaid_grade'])
    expect(coerceReadabilityMethods([])).toEqual(['flesch_kincaid_grade'])
  })

  it('builds column labels for enabled methods', () => {
    const labels = buildReadabilityColumnLabels(['flesch_kincaid_grade'])
    expect(labels.flesch_kincaid_grade).toBe('Flesch-Kincaid Grade')
    expect(labels.url).toBe('Page URL')
  })

  it('falls back legacy readability_score to Flesch Reading Ease', () => {
    const scores = resolvePageReadabilityScores({ readability_score: 72 })
    expect(scores.flesch_reading_ease).toBe(72)
    expect(scores.ari).toBeNull()
  })

  it('reads stored readability_scores JSON', () => {
    const scores = resolvePageReadabilityScores({
      readability_scores: { ari: 8.5, smog: null },
      readability_score: 70
    })
    expect(scores.ari).toBe(8.5)
    expect(scores.smog).toBeNull()
    expect(scores.flesch_reading_ease).toBe(70)
  })

  it('parses readability_scores when stored as a JSON string', () => {
    const scores = resolvePageReadabilityScores({
      readability_scores: JSON.stringify({ flesch_kincaid_grade: 9.2 })
    })
    expect(scores.flesch_kincaid_grade).toBe(9.2)
  })

  it('computes scores from html_snapshot when stored scores are missing', () => {
    const html = `<article>${'Playing games has always been important. '.repeat(40)}</article>`
    const scores = resolvePageReadabilityScores({ html_snapshot: html })
    expect(scores.flesch_kincaid_grade).toBeTypeOf('number')
    expect(scores.flesch_reading_ease).toBeTypeOf('number')
  })

  it('prefers main-content scores from html_snapshot over stored scores', () => {
    const html = `<nav>${'Navigation noise. '.repeat(200)}</nav><article>${'Playing games has always been important. '.repeat(40)}</article>`
    const scores = resolvePageReadabilityScores({
      readability_scores: { flesch_kincaid_grade: 42.9 },
      html_snapshot: html
    })
    expect(scores.flesch_kincaid_grade!).toBeLessThan(20)
  })

  it('classifies grade-level scores as good, warning, or bad', () => {
    expect(getReadabilityScoreStatus('flesch_kincaid_grade', 7)).toBe('good')
    expect(getReadabilityScoreStatus('flesch_kincaid_grade', 9)).toBe('warning')
    expect(getReadabilityScoreStatus('flesch_kincaid_grade', 12)).toBe('bad')
    expect(getReadabilityScoreStatus('flesch_kincaid_grade', null)).toBeNull()
  })

  it('classifies reading ease with inverted thresholds', () => {
    expect(getReadabilityScoreStatus('flesch_reading_ease', 65)).toBe('good')
    expect(getReadabilityScoreStatus('flesch_reading_ease', 55)).toBe('warning')
    expect(getReadabilityScoreStatus('flesch_reading_ease', 40)).toBe('bad')
  })

  it('maps scores to gauge positions and averages them', () => {
    expect(scoreToGaugePosition('flesch_kincaid_grade', 8)).toBeGreaterThan(20)
    expect(scoreToGaugePosition('flesch_reading_ease', 70)).toBe(30)

    const pages = [
      {
        url: '/a',
        title: 'A',
        word_count: 100,
        scores: resolvePageReadabilityScores({ readability_scores: { flesch_kincaid_grade: 8 } })
      },
      {
        url: '/b',
        title: 'B',
        word_count: 100,
        scores: resolvePageReadabilityScores({ readability_scores: { flesch_kincaid_grade: 10 } })
      }
    ]
    expect(averageRawScore(pages, 'flesch_kincaid_grade')).toBe(9)
    expect(averageGaugePosition(pages, 'flesch_kincaid_grade')).not.toBeNull()
  })
})

describe('readabilityDistribution utils', () => {
  it('buckets grade-level scores into reading-age bands', () => {
    expect(bucketForScore('flesch_kincaid_grade', 7.5)?.label).toBe('12–13 years old')
    expect(bucketForScore('flesch_kincaid_grade', 10.2)?.label).toBe('15–16 years old')
    expect(bucketForScore('flesch_kincaid_grade', 14)?.label).toBe('18 years old +')
  })

  it('builds page counts per bucket', () => {
    const pages = [
      { url: '/a', title: 'A', word_count: 100, scores: { flesch_kincaid_grade: 7 } as never },
      { url: '/b', title: 'B', word_count: 100, scores: { flesch_kincaid_grade: 7.5 } as never },
      { url: '/c', title: 'C', word_count: 100, scores: { flesch_kincaid_grade: 10 } as never }
    ]
    const rows = buildReadabilityDistribution(pages, 'flesch_kincaid_grade')
    const byLabel = Object.fromEntries(rows.map(row => [row.bucket.label, row.count]))
    expect(byLabel['12–13 years old']).toBe(2)
    expect(byLabel['15–16 years old']).toBe(1)
  })
})
