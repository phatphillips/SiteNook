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

export interface ReadabilityPageRow {
  id?: string
  url: string
  title: string
  word_count: number
  scores: ReadabilityScores
}

export interface ReadabilityMethodMeta {
  id: ReadabilityMethodId
  badge: string
  badgeClass: string
  label: string
  shortLabel: string
  scale: string
  formula: string
  bestPractice: string
  minContent: string
  summary: string
  /** TanStack default sort direction for this column. */
  sortDesc: boolean
}

export const READABILITY_METHODS: ReadabilityMethodMeta[] = [
  {
    id: 'ari',
    badge: 'ARI',
    badgeClass: 'readability-badge--ari',
    label: 'Automated Readability Index',
    shortLabel: 'ARI',
    scale: 'US grade level (lower = easier)',
    formula: 'Per-sentence ARI averaged across the page',
    bestPractice: 'Aim for 7th–8th grade (score ≤ 9). Focus on pages scoring 11+.',
    minContent: 'Needs enough body text (~50 characters).',
    summary: 'Scores each sentence individually, then averages for the page grade.',
    sortDesc: true
  },
  {
    id: 'coleman_liau',
    badge: 'CL',
    badgeClass: 'readability-badge--cl',
    label: 'Coleman-Liau',
    shortLabel: 'Coleman-Liau',
    scale: 'US grade level (lower = easier)',
    formula: 'Based on average letters per 100 words and sentences per 100 words.',
    bestPractice: 'Aim for 7th–8th grade (score ≤ 8). Focus on pages scoring 10+.',
    minContent: 'Requires at least 100 words.',
    summary: 'Focuses on long words and long sentences; best on longer passages.',
    sortDesc: true
  },
  {
    id: 'flesch_kincaid_grade',
    badge: 'FK-GL',
    badgeClass: 'readability-badge--fk-gl',
    label: 'Flesch-Kincaid Grade Level',
    shortLabel: 'Flesch-Kincaid Grade',
    scale: 'US grade level (lower = easier)',
    formula: '0.39 × (words ÷ sentences) + 11.8 × (syllables ÷ words) − 15.59',
    bestPractice: 'Aim for 7th–8th grade. Focus on pages scoring 10+.',
    minContent: 'Needs enough body text (~50 characters).',
    summary: 'Uses polysyllabic words and sentence length to estimate school grade level.',
    sortDesc: true
  },
  {
    id: 'flesch_reading_ease',
    badge: 'FK-RE',
    badgeClass: 'readability-badge--fk-re',
    label: 'Flesch-Kincaid Reading Ease',
    shortLabel: 'Flesch Reading Ease',
    scale: '0–100 (higher = easier)',
    formula: '206.835 − 1.015 × (words ÷ sentences) − 84.6 × (syllables ÷ words)',
    bestPractice: 'Aim for 60–70 (7th–8th grade). Focus on pages scoring 60 or below.',
    minContent: 'Needs enough body text (~50 characters).',
    summary: 'Widely used US government standard; higher scores mean easier reading.',
    sortDesc: false
  },
  {
    id: 'gunning_fog',
    badge: 'GF',
    badgeClass: 'readability-badge--gf',
    label: 'Gunning Fog',
    shortLabel: 'Gunning Fog',
    scale: 'US grade level (lower = easier)',
    formula: '0.4 × [(words ÷ sentences) + 100 × (complex words ÷ words)]',
    bestPractice: 'Aim for 7th–8th grade (score ≤ 8). Focus on pages scoring 10+.',
    minContent: 'Requires at least 100 words.',
    summary: 'Weights complex (3+ syllable) words and average sentence length.',
    sortDesc: true
  },
  {
    id: 'lix',
    badge: 'LIX',
    badgeClass: 'readability-badge--lix',
    label: 'LIX',
    shortLabel: 'LIX',
    scale: 'Index (lower = easier)',
    formula: '(words ÷ sentences) + (long words × 100 ÷ words); long word = more than 6 letters',
    bestPractice: 'Aim for ≤ 34 (easy for practiced readers). Focus on pages scoring 45+.',
    minContent: 'Needs enough body text (~50 characters).',
    summary: 'Works across Western European languages using word, sentence, and long-word counts.',
    sortDesc: true
  },
  {
    id: 'smog',
    badge: 'SMOG',
    badgeClass: 'readability-badge--smog',
    label: 'SMOG',
    shortLabel: 'SMOG',
    scale: 'US grade level (lower = easier)',
    formula: 'Based on polysyllable count scaled to 30 sentences.',
    bestPractice: 'Aim for 7th–8th grade (score ≤ 8). Focus on pages scoring 10+.',
    minContent: 'Requires at least 30 sentences.',
    summary: 'Polysyllable-focused grade estimate; unreliable on short web pages.',
    sortDesc: true
  }
]

const methodById = new Map(READABILITY_METHODS.map(m => [m.id, m]))

export function getReadabilityMethod(id: ReadabilityMethodId): ReadabilityMethodMeta {
  const meta = methodById.get(id)
  if (!meta) throw new Error(`Unknown readability method: ${id}`)
  return meta
}

export const DEFAULT_READABILITY_METHODS: ReadabilityMethodId[] = ['flesch_kincaid_grade']

export function coerceReadabilityMethods(value: unknown): ReadabilityMethodId[] {
  const fallback = [...DEFAULT_READABILITY_METHODS]
  if (!Array.isArray(value)) return fallback

  const allowed = new Set<string>(READABILITY_METHOD_IDS)
  const filtered = value.filter((id): id is ReadabilityMethodId =>
    typeof id === 'string' && allowed.has(id)
  )
  if (!filtered.length) return fallback
  if (filtered.length === 1) return [filtered[0]]

  // Legacy sites may have stored multiple methods — default to FK-GL when available.
  if (filtered.includes('flesch_kincaid_grade')) return ['flesch_kincaid_grade']
  return [filtered[0]]
}

export function readabilityMethodDetailRows(methodIds: ReadabilityMethodId[]) {
  return methodIds.map(id => {
    const meta = getReadabilityMethod(id)
    return {
      id,
      badge: meta.badge,
      badgeClass: meta.badgeClass,
      label: meta.label
    }
  })
}

export function formatReadabilityScore(value: number | null | undefined): string {
  if (value == null || value === 0) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function buildReadabilityColumnLabels(enabledMethods: ReadabilityMethodId[]): Record<string, string> {
  const labels: Record<string, string> = {
    url: 'Page URL',
    title: 'Title',
    word_count: 'Words'
  }
  for (const id of enabledMethods) {
    labels[id] = getReadabilityMethod(id).badge
  }
  return labels
}

export type ReadabilityScoreStatus = 'good' | 'warning' | 'bad'

interface ScoreThresholds {
  goodMax?: number
  goodMin?: number
  warningMax?: number
  warningMin?: number
}

const SCORE_THRESHOLDS: Record<ReadabilityMethodId, ScoreThresholds> = {
  ari: { goodMax: 9, warningMax: 10 },
  coleman_liau: { goodMax: 8, warningMax: 9 },
  flesch_kincaid_grade: { goodMax: 8, warningMax: 9 },
  flesch_reading_ease: { goodMin: 60, warningMin: 50 },
  gunning_fog: { goodMax: 8, warningMax: 9 },
  lix: { goodMax: 34, warningMax: 44 },
  smog: { goodMax: 8, warningMax: 9 }
}

export function getPrimaryReadabilityMethod(
  enabledMethods: ReadabilityMethodId[]
): ReadabilityMethodId | null {
  return enabledMethods[0] ?? null
}

export function getReadabilityScoreStatus(
  methodId: ReadabilityMethodId,
  score: number | null | undefined
): ReadabilityScoreStatus | null {
  if (score == null || score === 0 || !Number.isFinite(score)) return null

  const thresholds = SCORE_THRESHOLDS[methodId]
  if (methodId === 'flesch_reading_ease') {
    if (score >= (thresholds.goodMin ?? 60)) return 'good'
    if (score >= (thresholds.warningMin ?? 50)) return 'warning'
    return 'bad'
  }

  if (score <= (thresholds.goodMax ?? 8)) return 'good'
  if (score <= (thresholds.warningMax ?? 9)) return 'warning'
  return 'bad'
}

export function readabilityScoreStatusClass(status: ReadabilityScoreStatus | null): string {
  if (status === 'good') return 'text-success font-medium'
  if (status === 'warning') return 'text-warning font-medium'
  if (status === 'bad') return 'text-error font-medium'
  return 'text-muted'
}

/** Map a raw score to 0–100 gauge position (0 = easy/green, 100 = hard/red). */
export function scoreToGaugePosition(methodId: ReadabilityMethodId, score: number): number {
  if (methodId === 'flesch_reading_ease') {
    return Math.max(0, Math.min(100, 100 - score))
  }
  if (methodId === 'lix') {
    return Math.max(0, Math.min(100, ((score - 15) / 45) * 100))
  }
  return Math.max(0, Math.min(100, ((score - 4) / 14) * 100))
}

export function averageGaugePosition(
  pages: ReadabilityPageRow[],
  methodId: ReadabilityMethodId
): number | null {
  const positions: number[] = []
  for (const page of pages) {
    const score = page.scores[methodId]
    if (score == null || score === 0) continue
    positions.push(scoreToGaugePosition(methodId, score))
  }
  if (!positions.length) return null
  const sum = positions.reduce((total, value) => total + value, 0)
  return Math.round((sum / positions.length) * 10) / 10
}

export function averageRawScore(
  pages: ReadabilityPageRow[],
  methodId: ReadabilityMethodId
): number | null {
  const scores: number[] = []
  for (const page of pages) {
    const score = page.scores[methodId]
    if (score == null || score === 0) continue
    scores.push(score)
  }
  if (!scores.length) return null
  const sum = scores.reduce((total, value) => total + value, 0)
  return Math.round((sum / scores.length) * 10) / 10
}
