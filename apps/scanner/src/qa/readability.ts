import {
  fleschReadingEaseScore,
  scoreAllReadabilityMethods,
  parseStoredReadabilityScores,
  emptyReadabilityScores
} from './readabilityMethods.js'

export { scoreAllReadabilityMethods, fleschReadingEaseScore, parseStoredReadabilityScores, emptyReadabilityScores }
export type { ReadabilityMethodId, ReadabilityScores } from './readabilityMethods.js'

/** Legacy helper — Flesch Reading Ease (0–100) for SEO and QA overview. */
export function scoreReadability(text: string): number {
  return fleschReadingEaseScore(text)
}
