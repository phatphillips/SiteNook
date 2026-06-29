import { describe, expect, it } from 'vitest'
import {
  countWords,
  scorePerSentenceAri,
  prepareTextForReadabilityScoring,
  splitProseSentences
} from '../../../src/qa/ariScoring.js'
import readability from 'text-readability'

const ARTICLE = `
# Animated SVG Logo

I recently replaced the logo on the top left corner with an animated SVG.

## Inspiration

The first time I saw such stroke animations in SVG is the Material Line Icons by Vjacheslav Trushkin.
It was cool, but I never thought about making one my own until I saw Mu-An Chiou's banner on her website.
I suddenly feel like I want to be the cool guy too!

## Breakdown

I downloaded Mu-An's SVG to read the code, cross-referencing the Material Line Icons.
I found the trick is quite interesting, they animated \`stroke-dasharray\` to achieve the effect.
This feels quite unintuitive as when you check the MDN documentation, it looks like a pretty boring attribute.

\`\`\`css
path {
  stroke-dasharray: 350px 0;
  animation: grow 10s ease forwards infinite;
}
\`\`\`

Hope you enjoy the article, and I'd love to see your animated SVG logo too!
`

describe('scorePerSentenceAri', () => {
  it('strips markdown and code fences before scoring', () => {
    const prose = prepareTextForReadabilityScoring(ARTICLE)
    expect(prose).not.toContain('stroke-dasharray:')
    expect(prose).not.toContain('```')
    expect(prose).toContain('Animated SVG Logo')
  })

  it('splits more sentences than text-readability when lowercase follows a period', () => {
    const prose = prepareTextForReadabilityScoring(ARTICLE)
    const ours = splitProseSentences(prose).length
    const theirs = readability.sentenceCount(prose)
    expect(ours).toBeGreaterThan(theirs)
  })

  it('returns a moderate grade on blog prose, not a postgraduate score', () => {
    const score = scorePerSentenceAri(ARTICLE)
    expect(score).toBeTypeOf('number')
    expect(score!).toBeGreaterThanOrEqual(5)
    expect(score!).toBeLessThanOrEqual(11)
  })

  it('scores much lower than document-level ARI on under-segmented text', () => {
    const prose = prepareTextForReadabilityScoring(ARTICLE)
    const perSentence = scorePerSentenceAri(prose)
    const documentAri = readability.automatedReadabilityIndex(prose)
    expect(perSentence!).toBeLessThan(documentAri)
  })

  it('counts words without markdown syntax noise', () => {
    const prose = prepareTextForReadabilityScoring(ARTICLE)
    expect(countWords(prose)).toBeGreaterThan(80)
    expect(countWords(prose)).toBeLessThan(200)
  })
})
