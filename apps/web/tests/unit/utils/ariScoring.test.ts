import { describe, expect, it } from 'vitest'
import {
  scorePerSentenceAri,
  splitProseSentences
} from '~/utils/ariScoring'

describe('ariScoring (web)', () => {
  it('averages per-sentence grades for technical blog prose', () => {
    const text = `
Inspiration

The first time I saw such stroke animations in SVG is the Material Line Icons by Vjacheslav Trushkin.
It was cool, but I never thought about making one my own until I saw Mu-An Chiou's banner on her website.
I found the trick is quite interesting, they animated stroke-dasharray to achieve the effect.
Hope you enjoy the article, and I'd love to see your animated SVG logo too!
`
    const score = scorePerSentenceAri(text)
    expect(score).toBeGreaterThanOrEqual(5)
    expect(score).toBeLessThanOrEqual(11)
    expect(splitProseSentences(text).length).toBeGreaterThanOrEqual(4)
  })
})
