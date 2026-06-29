import { describe, expect, it } from 'vitest'
import { computeReadabilityTextStats, interpretGradeLevelScore } from '~/utils/readabilityPageStats'

describe('readabilityPageStats', () => {
  it('computes character, sentence, and word counts from prose', () => {
    const stats = computeReadabilityTextStats(
      'This is one sentence. Here is another sentence. And a third one here.'
    )
    expect(stats.sentenceCount).toBe(3)
    expect(stats.wordCount).toBe(13)
    expect(stats.characterCount).toBeGreaterThan(50)
  })

  it('interprets ARI grade 10 as fairly difficult', () => {
    const result = interpretGradeLevelScore('ari', 10)
    expect(result?.gradeLabel).toBe('10th grade')
    expect(result?.difficulty).toContain('Fairly difficult')
  })

  it('interprets easy reading ease scores', () => {
    const result = interpretGradeLevelScore('flesch_reading_ease', 72)
    expect(result?.gradeLabel).toBe('Easy')
  })
})
