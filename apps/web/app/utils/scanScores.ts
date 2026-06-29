import type { Scan } from '~/types/accessiq'

/** Use persisted scan score when present and non-zero; live only when stored is 0 or missing. */
export function preferStoredScanScore(
  stored: number | null | undefined,
  live: number
): number {
  if (stored != null && stored !== 0) return stored
  return live
}

/** Stored overall is meaningful enough to compare scan-to-scan deltas. */
export function hasMeaningfulStoredOverall(
  scan: Pick<Scan, 'score_overall'> | null | undefined
): boolean {
  return scan?.score_overall != null && scan.score_overall > 1
}

const WCAG_SCORE_POOL = 90
const BP_SCORE_POOL = 10
const STORED_LEVEL_WEIGHT = { A: 3, AA: 2, AAA: 1 } as const

/** Derive accessibility best-practice progress from stored overall + level scores (legacy scans). */
export function deriveBestPracticeFromStoredScan(
  scan: Pick<Scan, 'score_overall' | 'score_a' | 'score_aa' | 'score_aaa'>
): number | null {
  if (scan.score_overall == null || scan.score_overall === 0) return null

  const levels = (['A', 'AA', 'AAA'] as const)
    .map(level => ({
      stored: level === 'A' ? scan.score_a : level === 'AA' ? scan.score_aa : scan.score_aaa,
      weight: STORED_LEVEL_WEIGHT[level]
    }))
    .filter(entry => entry.stored != null && entry.stored > 0)

  if (!levels.length) return null

  const totalWeight = levels.reduce((sum, entry) => sum + entry.weight, 0)
  let wcagEarned = 0
  for (const { stored, weight } of levels) {
    const share = (weight / totalWeight) * WCAG_SCORE_POOL
    wcagEarned += share * (stored! / 100)
  }

  const bpEarned = scan.score_overall - wcagEarned
  if (bpEarned >= BP_SCORE_POOL - 0.05) return 100
  if (bpEarned <= 0) return null

  return Math.round((bpEarned / BP_SCORE_POOL) * 1000) / 10
}

/** Resolve best-practice row score: stored field, legacy derive, then live. */
export function resolveBestPracticeScore(
  scan: Pick<Scan, 'score_best_practices' | 'score_overall' | 'score_a' | 'score_aa' | 'score_aaa'>,
  live: number
): number {
  const stored = scan.score_best_practices ?? deriveBestPracticeFromStoredScan(scan)
  return preferStoredScanScore(stored, live)
}
