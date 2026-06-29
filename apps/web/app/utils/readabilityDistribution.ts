import type { ReadabilityMethodId, ReadabilityPageRow } from '~/utils/readabilityMethods'

export interface ReadabilityDistributionBucket {
  id: string
  label: string
  /** Inclusive lower bound. */
  min: number
  /** Exclusive upper bound (use Infinity for the last bucket). */
  max: number
}

const READING_AGE_BUCKETS: ReadabilityDistributionBucket[] = [
  { id: '12-13', label: '12–13 years old', min: Number.NEGATIVE_INFINITY, max: 8 },
  { id: '13-14', label: '13–14 years old', min: 8, max: 9 },
  { id: '14-15', label: '14–15 years old', min: 9, max: 10 },
  { id: '15-16', label: '15–16 years old', min: 10, max: 11 },
  { id: '16-17', label: '16–17 years old', min: 11, max: 12 },
  { id: '18+', label: '18 years old +', min: 12, max: Number.POSITIVE_INFINITY }
]

const READING_EASE_BUCKETS: ReadabilityDistributionBucket[] = [
  { id: 'very-easy', label: '90–100 · Very easy', min: 90, max: 101 },
  { id: 'easy', label: '70–89 · Easy', min: 70, max: 90 },
  { id: 'standard', label: '60–69 · Standard', min: 60, max: 70 },
  { id: 'fairly-difficult', label: '50–59 · Fairly difficult', min: 50, max: 60 },
  { id: 'difficult', label: '30–49 · Difficult', min: 30, max: 50 },
  { id: 'very-difficult', label: '0–29 · Very difficult', min: Number.NEGATIVE_INFINITY, max: 30 }
]

const LIX_BUCKETS: ReadabilityDistributionBucket[] = [
  { id: 'very-easy', label: '≤ 25 · Very easy', min: Number.NEGATIVE_INFINITY, max: 25 },
  { id: 'easy', label: '26–34 · Easy', min: 25, max: 35 },
  { id: 'standard', label: '35–44 · Standard', min: 35, max: 45 },
  { id: 'difficult', label: '45–54 · Difficult', min: 45, max: 55 },
  { id: 'very-difficult', label: '55+ · Very difficult', min: 55, max: Number.POSITIVE_INFINITY }
]

const GRADE_LEVEL_METHODS = new Set<ReadabilityMethodId>([
  'ari',
  'coleman_liau',
  'flesch_kincaid_grade',
  'gunning_fog',
  'smog'
])

export function getReadabilityDistributionBuckets(
  methodId: ReadabilityMethodId
): ReadabilityDistributionBucket[] {
  if (methodId === 'flesch_reading_ease') return READING_EASE_BUCKETS
  if (methodId === 'lix') return LIX_BUCKETS
  if (GRADE_LEVEL_METHODS.has(methodId)) return READING_AGE_BUCKETS
  return READING_AGE_BUCKETS
}

export function scoreFitsBucket(score: number, bucket: ReadabilityDistributionBucket): boolean {
  if (bucket.max === Number.POSITIVE_INFINITY) return score >= bucket.min
  return score >= bucket.min && score < bucket.max
}

export function bucketForScore(
  methodId: ReadabilityMethodId,
  score: number | null | undefined
): ReadabilityDistributionBucket | null {
  if (score == null || !Number.isFinite(score) || score === 0) return null
  const buckets = getReadabilityDistributionBuckets(methodId)
  return buckets.find(bucket => scoreFitsBucket(score, bucket)) ?? null
}

export interface ReadabilityDistributionRow {
  bucket: ReadabilityDistributionBucket
  count: number
}

export function buildReadabilityDistribution(
  pages: ReadabilityPageRow[],
  methodId: ReadabilityMethodId
): ReadabilityDistributionRow[] {
  const buckets = getReadabilityDistributionBuckets(methodId)
  const counts = new Map(buckets.map(bucket => [bucket.id, 0]))

  for (const page of pages) {
    const score = page.scores[methodId]
    const bucket = bucketForScore(methodId, score)
    if (!bucket) continue
    counts.set(bucket.id, (counts.get(bucket.id) ?? 0) + 1)
  }

  return buckets.map(bucket => ({
    bucket,
    count: counts.get(bucket.id) ?? 0
  }))
}

/** Approximate reading age for US grade-level scores. */
export function approximateReadingAge(gradeLevel: number): string {
  const age = Math.round(gradeLevel + 5)
  return `~${age} years old`
}
