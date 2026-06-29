import { describe, expect, it } from 'vitest'
import {
  fleschReadingEaseScore,
  scoreAllReadabilityMethods,
  READABILITY_METHOD_IDS
} from '../../../src/qa/readabilityMethods.js'

const sampleText = `
Playing games has always been thought to be important to
the development of well-balanced and creative children;
however, what part, if any, they should play in the lives
of adults has never been researched that deeply. I believe
that playing games is every bit as important for adults
as for children. Not only is taking time out to play games
with our children and other adults valuable to building
interpersonal relationships but is also a wonderful way
to release built up tension. Games help us learn strategy,
patience, and cooperation while keeping our minds active.
`

describe('scoreAllReadabilityMethods', () => {
  it('returns all method keys', () => {
    const scores = scoreAllReadabilityMethods(sampleText)
    for (const id of READABILITY_METHOD_IDS) {
      expect(Object.keys(scores)).toContain(id)
    }
  })

  it('scores common methods on sample text', () => {
    const scores = scoreAllReadabilityMethods(sampleText)
    expect(scores.ari).toBeTypeOf('number')
    expect(scores.flesch_reading_ease).toBeTypeOf('number')
    expect(scores.flesch_kincaid_grade).toBeTypeOf('number')
    expect(scores.lix).toBeTypeOf('number')
    expect(scores.flesch_reading_ease).toBeGreaterThan(0)
    expect(scores.flesch_reading_ease).toBeLessThanOrEqual(100)
  })

  it('returns null for short text', () => {
    const scores = scoreAllReadabilityMethods('Too short.')
    expect(scores.ari).toBeNull()
    expect(scores.flesch_reading_ease).toBeNull()
    expect(scores.coleman_liau).toBeNull()
    expect(scores.gunning_fog).toBeNull()
    expect(scores.smog).toBeNull()
  })

  it('returns null for coleman-liau and gunning fog under 100 words', () => {
    const medium = 'word '.repeat(80).trim()
    const scores = scoreAllReadabilityMethods(medium)
    expect(scores.coleman_liau).toBeNull()
    expect(scores.gunning_fog).toBeNull()
  })

  it('returns null for smog without 30 sentences', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `This is sentence number ${i + 1}.`).join(' ')
    const scores = scoreAllReadabilityMethods(sentences)
    expect(scores.smog).toBeNull()
  })

  it('scores smog with enough sentences', () => {
    const sentences = Array.from({ length: 35 }, (_, i) =>
      `This is a moderately complex sentence number ${i + 1} for readability testing purposes.`
    ).join(' ')
    const scores = scoreAllReadabilityMethods(sentences)
    expect(scores.smog).toBeTypeOf('number')
  })
})

describe('fleschReadingEaseScore', () => {
  it('returns 0 for empty text', () => {
    expect(fleschReadingEaseScore('')).toBe(0)
  })

  it('matches flesch_reading_ease from scoreAllReadabilityMethods', () => {
    const scores = scoreAllReadabilityMethods(sampleText)
    expect(fleschReadingEaseScore(sampleText)).toBe(scores.flesch_reading_ease)
  })
})

describe('LIX', () => {
  it('produces a reasonable index on sample text', () => {
    const scores = scoreAllReadabilityMethods(sampleText)
    expect(scores.lix).toBeTypeOf('number')
    expect(scores.lix!).toBeGreaterThan(10)
    expect(scores.lix!).toBeLessThan(80)
  })
})
