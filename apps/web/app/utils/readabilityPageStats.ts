import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import {
  countAriCharacters,
  countWords,
  prepareTextForReadabilityScoring,
  splitProseSentences
} from '~/utils/ariScoring'

export interface ReadabilityTextStats {
  characterCount: number
  sentenceCount: number
  wordCount: number
}

export interface ReadabilityScoreInterpretation {
  gradeLabel: string
  difficulty: string
}

export function computeReadabilityTextStats(text: string): ReadabilityTextStats {
  const prepared = prepareTextForReadabilityScoring(text)
  return {
    characterCount: countAriCharacters(prepared),
    sentenceCount: splitProseSentences(prepared).length,
    wordCount: countWords(prepared)
  }
}

function ordinalGrade(score: number): string {
  const grade = Math.max(1, Math.round(score))
  if (grade >= 14) return 'College level'
  if (grade === 1) return '1st grade'
  if (grade === 2) return '2nd grade'
  if (grade === 3) return '3rd grade'
  return `${grade}th grade`
}

export function interpretGradeLevelScore(
  methodId: ReadabilityMethodId,
  score: number
): ReadabilityScoreInterpretation | null {
  if (!Number.isFinite(score)) return null

  if (methodId === 'flesch_reading_ease') {
    if (score >= 80) return { gradeLabel: 'Very easy', difficulty: 'Readable by most audiences' }
    if (score >= 70) return { gradeLabel: 'Easy', difficulty: 'Suitable for general audiences' }
    if (score >= 60) return { gradeLabel: 'Standard', difficulty: 'Plain English for the web' }
    if (score >= 50) return { gradeLabel: 'Fairly difficult', difficulty: 'Consider simplifying sentences' }
    if (score >= 30) return { gradeLabel: 'Difficult', difficulty: 'Hard for many readers' }
    return { gradeLabel: 'Very difficult', difficulty: 'Best understood by experts' }
  }

  if (methodId === 'lix') {
    if (score <= 25) return { gradeLabel: 'Very easy', difficulty: 'Accessible for most readers' }
    if (score <= 34) return { gradeLabel: 'Easy', difficulty: 'Comfortable for general audiences' }
    if (score <= 44) return { gradeLabel: 'Standard', difficulty: 'Typical for news and blogs' }
    if (score <= 54) return { gradeLabel: 'Difficult', difficulty: 'May challenge casual readers' }
    return { gradeLabel: 'Very difficult', difficulty: 'Best for specialized audiences' }
  }

  const gradeLabel = ordinalGrade(score)
  if (score <= 6) return { gradeLabel, difficulty: 'Easy to read' }
  if (score <= 8) return { gradeLabel, difficulty: 'Good readability' }
  if (score <= 9) return { gradeLabel, difficulty: 'Acceptable for most audiences' }
  if (score <= 11) return { gradeLabel, difficulty: 'Fairly difficult to read' }
  if (score <= 13) return { gradeLabel, difficulty: 'Difficult to read' }
  return { gradeLabel, difficulty: 'Very difficult to read' }
}

export function formatStatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString()
}
