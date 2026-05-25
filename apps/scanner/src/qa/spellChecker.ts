import nspell from 'nspell'
import dictionaryModule from 'dictionary-en'

const dictionary = dictionaryModule as unknown as { aff: Uint8Array, dic: Uint8Array }

let spell: ReturnType<typeof nspell> | null = null

export async function initSpellChecker() {
  if (spell) return

  spell = nspell({
    aff: Buffer.from(dictionary.aff),
    dic: Buffer.from(dictionary.dic)
  })
}

export interface SpellingRecord {
  word: string
  context: string
  confidence: 'error' | 'review'
  status: string
}

const customDictionary = new Set<string>()

export function addToDictionary(word: string) {
  customDictionary.add(word.toLowerCase())
}

export function checkSpelling(text: string): SpellingRecord[] {
  if (!spell) return []

  const words = text.match(/\b[a-zA-Z]{3,}\b/g) || []
  const seen = new Set<string>()
  const results: SpellingRecord[] = []

  for (const word of words) {
    const lower = word.toLowerCase()
    if (seen.has(lower) || customDictionary.has(lower)) continue
    seen.add(lower)

    if (!spell.correct(lower)) {
      const suggestions = spell.suggest(lower)
      results.push({
        word: lower,
        context: extractContext(text, word),
        confidence: suggestions.length > 0 ? 'error' : 'review',
        status: 'open'
      })
    }
  }

  return results.slice(0, 100)
}

function extractContext(text: string, word: string): string {
  const idx = text.toLowerCase().indexOf(word.toLowerCase())
  if (idx === -1) return word
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + word.length + 40)
  return text.slice(start, end).trim()
}
