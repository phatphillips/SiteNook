import readability from 'text-readability'
import type { ReadabilityMethodId, ReadabilityScores } from '~/utils/readabilityMethods'
import { READABILITY_METHOD_IDS } from '~/utils/readabilityMethods'
import { extractReadablePageContent } from '~/utils/extractReadablePageText'
import { scorePerSentenceAri, prepareTextForReadabilityScoring } from '~/utils/ariScoring'

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

function scoreMethod(
  id: ReadabilityMethodId,
  text: string,
  wordCount: number,
  sentenceCount: number
): number | null {
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

export function htmlSnapshotToPlainText(html: string, title?: string): string {
  return extractReadablePageContent(html, { title }).text
}

function parseStoredReadabilityScoresRaw(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

export function resolvePageReadabilityScores(
  page: {
    readability_scores?: Record<string, number | null> | string | null
    readability_score?: number | null
    html_snapshot?: string | null
  }
): ReadabilityScores {
  const scores = {} as ReadabilityScores
  for (const id of READABILITY_METHOD_IDS) {
    scores[id] = null
  }

  const stored = parseStoredReadabilityScoresRaw(page.readability_scores)
  if (stored) {
    for (const id of READABILITY_METHOD_IDS) {
      const value = stored[id]
      scores[id] = typeof value === 'number' && Number.isFinite(value) ? value : null
    }
  }

  const legacyScore = page.readability_score
  if (
    scores.flesch_reading_ease == null
    && typeof legacyScore === 'number'
    && Number.isFinite(legacyScore)
    && legacyScore > 0
  ) {
    scores.flesch_reading_ease = legacyScore
  }

  if (page.html_snapshot?.trim()) {
    const text = htmlSnapshotToPlainText(page.html_snapshot)
    if (text.length >= 50) {
      const computed = scoreAllReadabilityMethods(text)
      for (const id of READABILITY_METHOD_IDS) {
        if (computed[id] != null) {
          scores[id] = computed[id]
        }
      }
    }
  }

  return scores
}
