import readability from 'text-readability'
import { scorePerSentenceAri, prepareTextForReadabilityScoring } from './ariScoring.js'

export const READABILITY_METHOD_IDS = [
  'ari',
  'coleman_liau',
  'flesch_kincaid_grade',
  'flesch_reading_ease',
  'gunning_fog',
  'lix',
  'smog'
] as const

export type ReadabilityMethodId = typeof READABILITY_METHOD_IDS[number]

export type ReadabilityScores = Record<ReadabilityMethodId, number | null>

const MIN_CHARS = 50

function roundScore(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function countSentences(text: string): number {
  try {
    return readability.sentenceCount(text)
  } catch {
    const matches = text.match(/[.!?]+(?:\s|$)|:\s+/g)
    return Math.max(1, matches?.length ?? 1)
  }
}

function scoreLix(text: string): number | null {
  const words = text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []
  const wordCount = words.length
  if (wordCount === 0) return null

  const longWords = words.filter(w => w.replace(/[^a-zA-Z]/g, '').length > 6).length
  const sentenceCount = countSentences(text)
  if (sentenceCount === 0) return null

  return roundScore(wordCount / sentenceCount + (longWords * 100) / wordCount)
}

function safeScore(fn: () => number): number | null {
  try {
    const value = fn()
    if (!Number.isFinite(value)) return null
    return roundScore(value)
  } catch {
    return null
  }
}

function scoreMethod(id: ReadabilityMethodId, text: string, wordCount: number, sentenceCount: number): number | null {
  const trimmed = text.trim()
  if (trimmed.length < MIN_CHARS) return null

  switch (id) {
    case 'ari':
      return scorePerSentenceAri(trimmed)
    case 'coleman_liau':
      if (wordCount < 100) return null
      return safeScore(() => readability.colemanLiauIndex(trimmed))
    case 'flesch_kincaid_grade':
      return safeScore(() => readability.fleschKincaidGrade(trimmed))
    case 'flesch_reading_ease': {
      const score = safeScore(() => readability.fleschReadingEase(trimmed))
      if (score == null) return null
      return Math.round(Math.max(0, Math.min(100, score)))
    }
    case 'gunning_fog':
      if (wordCount < 100) return null
      return safeScore(() => readability.gunningFog(trimmed))
    case 'lix':
      return scoreLix(trimmed)
    case 'smog':
      if (sentenceCount < 30) return null
      return safeScore(() => readability.smogIndex(trimmed))
    default:
      return null
  }
}

export function scoreAllReadabilityMethods(text: string): ReadabilityScores {
  const trimmed = prepareTextForReadabilityScoring(text?.trim() ?? '')
  const wordCount = countWords(trimmed)
  const sentenceCount = countSentences(trimmed)

  const scores = {} as ReadabilityScores
  for (const id of READABILITY_METHOD_IDS) {
    scores[id] = scoreMethod(id, trimmed, wordCount, sentenceCount)
  }
  return scores
}

export function fleschReadingEaseScore(text: string): number {
  const score = scoreAllReadabilityMethods(text).flesch_reading_ease
  return score ?? 0
}

export function emptyReadabilityScores(): ReadabilityScores {
  const scores = {} as ReadabilityScores
  for (const id of READABILITY_METHOD_IDS) {
    scores[id] = null
  }
  return scores
}

export function parseStoredReadabilityScores(
  raw: unknown,
  legacyScore?: number
): ReadabilityScores {
  const scores = emptyReadabilityScores()
  if (raw && typeof raw === 'object') {
    const stored = raw as Record<string, unknown>
    for (const id of READABILITY_METHOD_IDS) {
      const value = stored[id]
      scores[id] = typeof value === 'number' && Number.isFinite(value) ? value : null
    }
  }
  if (scores.flesch_reading_ease == null && legacyScore) {
    scores.flesch_reading_ease = legacyScore
  }
  return scores
}
