import { describe, it, expect, beforeEach } from 'vitest'
import {
  addToDictionary,
  checkSpelling,
  initSpellChecker
} from '../../../src/qa/spellChecker.js'

describe('initSpellChecker', () => {
  it('returns without throwing', async () => {
    await expect(initSpellChecker()).resolves.toBeUndefined()
  })
})

describe('checkSpelling', () => {
  beforeEach(async () => {
    await initSpellChecker()
  })

  it('returns an empty array for text with no spelling errors', () => {
    const results = checkSpelling('The quick brown fox jumps over the lazy dog.')

    expect(results).toEqual([])
  })

  it('flags a deliberately misspelled word', () => {
    const results = checkSpelling('This sentense has a misspelled wrd.')

    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.word === 'sentense' || r.word === 'wrd')).toBe(true)
  })

  it('does not flag custom dictionary entries', () => {
    addToDictionary('accessiq')
    const results = checkSpelling('Welcome to AccessIQ monitoring platform.')

    expect(results.find(r => r.word === 'accessiq')).toBeUndefined()
  })
})
