import { describe, expect, it } from 'vitest'
import {
  filterProseBlocks,
  looksLikeNonProseBlock,
  stripToReadabilityProse
} from '../../../src/qa/proseForReadability.js'

describe('stripToReadabilityProse', () => {
  it('removes fenced and inline code without keeping identifiers', () => {
    const input = `Intro about TypeScript configs.

\`\`\`ts
export default defineConfig({ plugins: [] })
\`\`\`

Use the \`defineConfig\` helper in both projects.`

    const prose = stripToReadabilityProse(input)
    expect(prose).toContain('Intro about TypeScript configs')
    expect(prose).toContain('both projects')
    expect(prose).not.toContain('defineConfig')
    expect(prose).not.toContain('plugins')
  })

  it('drops URL-only and file-path lines', () => {
    const prose = stripToReadabilityProse(`Real paragraph with enough words to count as prose here.

https://example.com/docs/readability

src/utils/config.ts

Another readable paragraph that should remain in the output.`)

    expect(prose).toContain('Real paragraph')
    expect(prose).toContain('Another readable paragraph')
    expect(prose).not.toContain('https://example.com')
    expect(prose).not.toContain('config.ts')
  })

  it('strips math blocks and frontmatter', () => {
    const prose = stripToReadabilityProse(`---
title: Ignored
---

Paragraph one about reading ease.

$$E = mc^2$$

Paragraph two continues the article.`)

    expect(prose).not.toContain('title: Ignored')
    expect(prose).not.toContain('mc^2')
    expect(prose).toContain('Paragraph one')
    expect(prose).toContain('Paragraph two')
  })
})

describe('filterProseBlocks', () => {
  it('removes css/json-like blocks and dedupes adjacent paragraphs', () => {
    const blocks = [
      'Readable intro with several words in it.',
      'Readable intro with several words in it.',
      '.class { color: red; margin: 0; padding: 0; }',
      '{"props":{"pageProps":{"ignored":true}}}',
      'Closing paragraph with normal prose content.'
    ]

    expect(filterProseBlocks(blocks)).toEqual([
      'Readable intro with several words in it.',
      'Closing paragraph with normal prose content.'
    ])
  })
})

describe('looksLikeNonProseBlock', () => {
  it('flags symbol-heavy code-like lines', () => {
    expect(looksLikeNonProseBlock('const x = () => { return 1; }')).toBe(true)
    expect(looksLikeNonProseBlock('This is a normal sentence for readers.')).toBe(false)
  })
})
