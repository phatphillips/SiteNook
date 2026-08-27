import type { Scan } from '~/types/sitenook'

export interface ScoreDelta {
  before: number
  after: number
  delta: number
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10
}

export function scoreFieldDelta(
  beforeScan: Scan | null | undefined,
  afterScan: Scan | null | undefined,
  field: 'score_seo' | 'score_overall'
): ScoreDelta | null {
  const before = beforeScan?.[field]
  const after = afterScan?.[field]
  if (before == null || after == null) return null
  return {
    before: roundScore(before),
    after: roundScore(after),
    delta: roundScore(after - before)
  }
}

export function formatScoreDelta(delta: ScoreDelta, label = 'Score'): string {
  const sign = delta.delta > 0 ? '+' : ''
  return `${label} ${delta.before} → ${delta.after} (${sign}${delta.delta})`
}
