import { formatAccessibilityScore } from '~/utils/siteimproveScore'

/** Tailwind text classes matching scoreRingColor thresholds. */
export function scoreTextClass(score: number): string {
  if (score >= 75) return 'text-green-600 dark:text-green-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

/** Display like "73.1 / 100". */
export function formatScoreOutOf100(score: number): string {
  return `${formatAccessibilityScore(score)} / 100`
}
