/**
 * Per-sentence Automated Readability Index (ARI).
 * Each sentence is scored individually, then averaged.
 */

import { stripToReadabilityProse } from './proseForReadability.js'

export function countWords(text: string): number {
  return text.match(/\b[\p{L}\p{N}'’-]+\b/gu)?.length ?? 0
}

/** Character count for ARI (text-readability compatible: no spaces). */
export function countAriCharacters(text: string): number {
  return text.replace(/ /g, '').length
}

export function splitProseSentences(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) return []

  const sentences: string[] = []
  const blocks = normalized.split(/\n+/).map(block => block.trim()).filter(Boolean)

  for (const block of blocks) {
    const parts = block
      .split(/(?<=[.!?])(?:['")\]]*)?\s+/)
      .map(part => part.trim())
      .filter(Boolean)

    for (const part of parts) {
      if (countWords(part) >= 2) {
        sentences.push(part)
      }
    }
  }

  return sentences
}

export function markdownToProseForScoring(markdown: string): string {
  return stripToReadabilityProse(markdown)
}

export function prepareTextForReadabilityScoring(text: string): string {
  return stripToReadabilityProse(text)
}

function roundScore(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Per-sentence ARI with a single-sentence word count. */
export function sentenceAriGrade(sentence: string): number | null {
  const words = countWords(sentence)
  if (words < 2) return null

  const chars = countAriCharacters(sentence)
  const grade = Math.round(4.71 * (chars / words) + 0.5 * words - 21.43)
  return Math.max(0, grade)
}

/** Overall ARI: average of per-sentence grades. */
export function scorePerSentenceAri(text: string): number | null {
  const prepared = prepareTextForReadabilityScoring(text)
  if (prepared.length < 50) return null

  const sentences = splitProseSentences(prepared)
  if (!sentences.length) return null

  const grades: number[] = []
  for (const sentence of sentences) {
    const grade = sentenceAriGrade(sentence)
    if (grade != null) grades.push(grade)
  }

  if (!grades.length) return null
  const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length
  return roundScore(average)
}
