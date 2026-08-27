import { describe, expect, it } from 'vitest'
import {
  HANDOFF_DEFAULT_PROMPTS,
  HANDOFF_PROMPT_HISTORY_MAX,
  HANDOFF_PROMPT_MAX_WORDS,
  clampPromptWords,
  countPromptWords,
  isUsingDefaultPrompt,
  parseHandoffPrompts,
  promptWordStatus,
  pushPromptHistory,
  resetSectionPrompt,
  resolveActivePrompt,
  saveSectionPrompt,
  sectionHistory
} from '~/utils/handoffSectionPrompts'

describe('handoffSectionPrompts', () => {
  it('resolves system defaults when prompt is missing or null', () => {
    expect(resolveActivePrompt({}, 'content')).toBe(HANDOFF_DEFAULT_PROMPTS.content)
    expect(resolveActivePrompt({ content: { prompt: null } }, 'content')).toBe(HANDOFF_DEFAULT_PROMPTS.content)
    expect(isUsingDefaultPrompt({ content: { prompt: null } }, 'content')).toBe(true)
  })

  it('resolves custom prompts when stored', () => {
    const stored = { accessibility: { prompt: '  Fix critical issues first.  ' } }
    expect(resolveActivePrompt(stored, 'accessibility')).toBe('Fix critical issues first.')
    expect(isUsingDefaultPrompt(stored, 'accessibility')).toBe(false)
  })

  it('caps and dedupes prompt history', () => {
    const history = Array.from({ length: 12 }, (_, i) => `prompt-${i}`)
    const next = pushPromptHistory(history, 'prompt-0')
    expect(next[0]).toBe('prompt-0')
    expect(next).toHaveLength(HANDOFF_PROMPT_HISTORY_MAX)
    expect(pushPromptHistory(['same'], 'same')).toEqual(['same'])
  })

  it('save pushes previous active prompt into history', () => {
    const saved = saveSectionPrompt(
      { content: { prompt: 'Old prompt', history: [] } },
      'content',
      'New prompt'
    )
    expect(saved.content?.prompt).toBe('New prompt')
    expect(saved.content?.history?.[0]).toBe('Old prompt')
  })

  it('reset clears custom prompt and keeps history', () => {
    const reset = resetSectionPrompt(
      { seo: { prompt: 'Custom SEO', history: ['earlier'] } },
      'seo'
    )
    expect(reset.seo?.prompt).toBeNull()
    expect(reset.seo?.history?.[0]).toBe('Custom SEO')
    expect(resolveActivePrompt(reset, 'seo')).toBe(HANDOFF_DEFAULT_PROMPTS.seo)
  })

  it('counts words and enforces soft/hard limits', () => {
    expect(countPromptWords('one two three')).toBe(3)
    expect(promptWordStatus('short')).toEqual({ words: 1, softWarn: true, overMax: false })
    const long = Array.from({ length: HANDOFF_PROMPT_MAX_WORDS + 5 }, (_, i) => `w${i}`).join(' ')
    expect(promptWordStatus(long).overMax).toBe(true)
    expect(countPromptWords(clampPromptWords(long))).toBe(HANDOFF_PROMPT_MAX_WORDS)
  })

  it('parses stored records safely', () => {
    expect(parseHandoffPrompts(null)).toEqual({})
    expect(sectionHistory({ qa: { history: ['a', 2 as unknown as string, 'b'] } }, 'qa')).toEqual(['a', 'b'])
  })
})
