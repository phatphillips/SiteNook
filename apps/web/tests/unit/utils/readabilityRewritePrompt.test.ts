import { describe, expect, it } from 'vitest'
import {
  buildChatGptPromptUrl,
  buildClaudePromptUrl,
  buildReadabilityRewritePrompt
} from '~/utils/readabilityRewritePrompt'

describe('readabilityRewritePrompt', () => {
  it('builds a rewrite prompt that references the page URL and target level', () => {
    const prompt = buildReadabilityRewritePrompt({
      url: 'https://example.com/about',
      title: 'About us',
      methodId: 'flesch_kincaid_grade',
      score: 12.4
    })

    expect(prompt).toContain('https://example.com/about')
    expect(prompt).toContain('About us')
    expect(prompt).toContain('Flesch-Kincaid Grade Level')
    expect(prompt).toContain('12.4')
    expect(prompt).toContain('Aim for 7th–8th grade')
    expect(prompt).toContain('rewrite the page content')
  })

  it('handles missing scores without inventing numbers', () => {
    const prompt = buildReadabilityRewritePrompt({
      url: 'https://example.com/page',
      methodId: 'ari',
      score: null
    })

    expect(prompt).toContain('https://example.com/page')
    expect(prompt).toContain('no score is available yet')
    expect(prompt).toContain('Aim for 7th–8th grade')
  })

  it('builds ChatGPT and Claude deep links with the encoded prompt', () => {
    const prompt = 'Rewrite https://example.com for grade 8.'
    const chatgpt = buildChatGptPromptUrl(prompt)
    const claude = buildClaudePromptUrl(prompt)

    expect(chatgpt).toBe(`https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`)
    expect(claude).toBe(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`)
  })
})
