import { DONUT_SEGMENT_TOKENS, scoreDonutSegments } from '~/utils/donutChart'

/** One slice in the breakdown modal donut + legend. */
export type ScoreBreakdownSlice = {
  id: string
  label: string
  /** Relative weight in the donut (score points, issue counts, etc.). */
  value: number
  color: string
  /** Optional score % shown in the right-hand row. */
  score?: number | null
  /** Short supporting line (e.g. "12 open issues"). */
  detail?: string
  /** Impact line (e.g. "-4.2 pts" or "+1.3"). */
  impact?: string | null
  href?: string
}

/** Compact KPI chip on the right-hand summary strip. */
export type ScoreBreakdownStat = {
  label: string
  value: string
  hint?: string
}

export type ScoreBreakdownModel = {
  title: string
  description?: string
  /** Centre value of the modal donut. */
  score: number
  unit?: string
  caption?: string
  delta?: string | null
  deltaLabel?: string
  /** Tooltip body for “How the score is calculated” under the donut. */
  scoreExplainer?: string
  /** Override for the explainer control label. */
  scoreExplainerLabel?: string
  /** Donut slices + legend (top-left). */
  slices: ScoreBreakdownSlice[]
  /**
   * Right-hand breakdown rows. Defaults to slices when omitted.
   * Use this for category detail while the donut stays score-vs-remaining.
   */
  rows?: ScoreBreakdownSlice[]
  /** Sort slices largest-first in the donut (category charts). */
  sortSlices?: boolean
  stats?: ScoreBreakdownStat[]
  /** Footnote under the category list. */
  footnote?: string
  ctaLabel?: string
  ctaTo?: string
}

/** Score vs remaining slices for progress-style overview donuts. */
export function progressScoreSlices(
  score: number,
  options: { scoreLabel?: string, remainderLabel?: string } = {}
): ScoreBreakdownSlice[] {
  const normalized = Math.max(0, Math.min(100, score))
  return scoreDonutSegments(score, options).map((segment, index) => {
    const isScore = index === 0 && segment.value === normalized
    return {
      id: isScore || segment.label.toLowerCase().includes('score') ? 'score' : 'remaining',
      label: segment.label,
      value: segment.value,
      color: segment.color ?? DONUT_SEGMENT_TOKENS[index]!,
      score: isScore || segment.label.toLowerCase().includes('score') ? normalized : segment.value,
      detail: isScore || segment.label.toLowerCase().includes('score')
        ? 'Share of the ring already earned'
        : 'Headroom before a perfect 100'
    }
  })
}

export function formatBreakdownDelta(delta: number | null | undefined): string | null {
  if (delta == null || Number.isNaN(delta)) return null
  const rounded = Math.round(delta * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return delta > 0 ? `+${text}` : text
}
