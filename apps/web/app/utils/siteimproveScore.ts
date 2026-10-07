/**
 * Siteimprove-style accessibility scoring (public documentation only. Not a patented clone).
 *
 * Model (see Siteimprove help / WebComm KB):
 * - 90 points: WCAG conformance (A / AA / AAA checks)
 * - 10 points: accessibility best practices
 * - Each check has a point budget by weight (A > AA > AAA > best practice)
 * - Per check: progress from resolved ratio (failed vs total occurrences)
 * - Logarithmic curve: fixing issues near 100% is worth more per occurrence
 * - Element denominators: e.g. image-alt vs total images on the site
 * - Dismissed issues count toward totals (resolved) but not failures
 * - Check catalog: passing axe rules still occupy pool weight so one fail cannot consume a level
 */

import type { A11yCheckStats } from './a11yCheckStats'
import { FALLBACK_AXE_CATALOG } from './axeCheckCatalog'

export type WcagLevel = 'A' | 'AA' | 'AAA'

export interface SiteimproveScoreIssue {
  rule_id: string
  wcag_level: WcagLevel
  element_type?: string
  status?: string
  /** True when the rule is a non-WCAG best-practice check */
  is_best_practice?: boolean
  /** Per-occurrence weight (page depth weighting); default 1 */
  weight?: number
}

export interface ElementTotals {
  image: number
  link: number
  form: number
  heading: number
  table: number
  media: number
  aria: number
  other: number
}

export interface QaDenominators {
  totalLinks: number
  totalWords: number
  totalPages: number
}

export interface ScoreDenominators {
  elements: ElementTotals
  qa: QaDenominators
}

export interface SiteimproveScores {
  /** Overall accessibility score (0–100), one decimal */
  overall: number
  levelA: number
  levelAA: number
  levelAAA: number
}

const WCAG_POOL = 90
const BP_POOL = 10
const QA_LINK_POOL = 65
const QA_SPELL_POOL = 35

const LEVEL_WEIGHT: Record<WcagLevel, number> = {
  A: 3,
  AA: 2,
  AAA: 1
}

const BP_WEIGHT = 0.5

/** Logarithmic progress toward earning a check's point budget (k tunes curve). */
export function logarithmicProgress(resolvedRatio: number, k = 9): number {
  if (resolvedRatio >= 1) return 1
  if (resolvedRatio <= 0) return 0
  const failureRatio = 1 - resolvedRatio
  return 1 - Math.log(1 + k * failureRatio) / Math.log(1 + k)
}

export function normalizedPageWeights(pages: Array<{ crawlDepth?: number }>): number[] {
  if (!pages.length) return []
  const raw = pages.map(p => 1 / ((p.crawlDepth ?? 0) + 1))
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return pages.map(() => 1 / pages.length)
  return raw.map(w => w / sum)
}

export function pageWeightScale(pageCount: number, depthWeightedScoring: boolean): number {
  return depthWeightedScoring ? pageCount : 1
}

const ELEMENT_DENOMINATOR_RULES: Record<string, keyof ElementTotals> = {
  'image-alt': 'image',
  'input-image-alt': 'image',
  'area-alt': 'image',
  'object-alt': 'image',
  'svg-img-alt': 'image',
  'role-img-alt': 'image',
  'link-name': 'link',
  'link-in-text-block': 'link',
  'label': 'form',
  'label-title-only': 'form',
  'form-field-multiple-labels': 'form',
  'select-name': 'form',
  'heading-order': 'heading',
  'empty-heading': 'heading',
  'page-has-heading-one': 'heading',
  'td-headers-attr': 'table',
  'th-has-data-cells': 'table',
  'table-fake-caption': 'table',
  'video-caption': 'media',
  'audio-caption': 'media',
  'video-description': 'media'
}

const BEST_PRACTICE_RULE_IDS = new Set([
  // Keep in sync with axe-core "best-practice" tagged rules (axe-core 4.11.x).
  'accesskeys',
  'aria-allowed-role',
  'aria-dialog-name',
  'aria-text',
  'aria-treeitem-name',
  'empty-heading',
  'empty-table-header',
  'focus-order-semantics',
  'frame-tested',
  'heading-order',
  'hidden-content',
  'image-redundant-alt',
  'label-title-only',
  'landmark-banner-is-top-level',
  'landmark-complementary-is-top-level',
  'landmark-contentinfo-is-top-level',
  'landmark-main-is-top-level',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-no-duplicate-main',
  'landmark-one-main',
  'landmark-unique',
  'meta-viewport-large',
  'page-has-heading-one',
  'presentation-role-conflict',
  'region',
  'scope-attr-valid',
  'skip-link',
  'tabindex',
  'table-duplicate-name'
])

export function isBestPracticeRule(ruleId: string, explicit?: boolean): boolean {
  if (explicit === true) return true
  if (explicit === false) return false
  return BEST_PRACTICE_RULE_IDS.has(ruleId)
}

export function emptyElementTotals(): ElementTotals {
  return { image: 0, link: 0, form: 0, heading: 0, table: 0, media: 0, aria: 0, other: 0 }
}

function countElementsInHtml(html: string): ElementTotals {
  return {
    image: (html.match(/<img\b/gi) ?? []).length,
    link: (html.match(/<a\b/gi) ?? []).length,
    form: (html.match(/<(input|select|textarea|form)\b/gi) ?? []).length,
    heading: (html.match(/<h[1-6]\b/gi) ?? []).length,
    table: (html.match(/<table\b/gi) ?? []).length,
    media: (html.match(/<(video|audio)\b/gi) ?? []).length,
    aria: 0,
    other: 0
  }
}

function addElementTotals(target: ElementTotals, source: ElementTotals, multiplier = 1) {
  for (const key of Object.keys(target) as (keyof ElementTotals)[]) {
    target[key] += source[key] * multiplier
  }
}

export function countElementsFromHtmlSnapshots(
  pages: Array<{ htmlSnapshot?: string, crawlDepth?: number }>,
  options?: { depthWeightedScoring?: boolean }
): ElementTotals {
  const totals = emptyElementTotals()
  if (!pages.length) return totals

  const depthWeighted = options?.depthWeightedScoring ?? false
  const weights = depthWeighted ? normalizedPageWeights(pages) : pages.map(() => 1 / pages.length)
  const scale = pageWeightScale(pages.length, depthWeighted)

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    const pageTotals = countElementsInHtml(page.htmlSnapshot ?? '')
    addElementTotals(totals, pageTotals, weights[i]! * scale)
  }

  return {
    image: Math.max(0, Math.round(totals.image)),
    link: Math.max(0, Math.round(totals.link)),
    form: Math.max(0, Math.round(totals.form)),
    heading: Math.max(0, Math.round(totals.heading)),
    table: Math.max(0, Math.round(totals.table)),
    media: Math.max(0, Math.round(totals.media)),
    aria: Math.max(0, Math.round(totals.aria)),
    other: Math.max(0, Math.round(totals.other))
  }
}

export function issuesFromPages(
  pages: Array<{ crawlDepth?: number, issues: SiteimproveScoreIssue[] }>,
  options?: { depthWeightedScoring?: boolean }
): SiteimproveScoreIssue[] {
  if (!pages.length) return []
  const depthWeighted = options?.depthWeightedScoring ?? false
  const weights = depthWeighted ? normalizedPageWeights(pages) : pages.map(() => 1)
  const scale = pageWeightScale(pages.length, depthWeighted)

  return pages.flatMap((page, index) =>
    page.issues.map(issue => ({
      ...issue,
      weight: (issue.weight ?? 1) * weights[index]! * scale
    }))
  )
}

export function countQaDenominatorsFromPages(
  pages: Array<{
    htmlSnapshot?: string
    crawlDepth?: number
    wordCount?: number
    brokenLinks?: Array<{ status?: string }>
    spelling?: Array<{ confidence?: string }>
  }>,
  options?: { depthWeightedScoring?: boolean }
): QaDenominators & { failedLinks: number, failedSpelling: number } {
  if (!pages.length) {
    return { totalLinks: 0, totalWords: 0, totalPages: 0, failedLinks: 0, failedSpelling: 0 }
  }

  const depthWeighted = options?.depthWeightedScoring ?? false
  const weights = depthWeighted ? normalizedPageWeights(pages) : pages.map(() => 1 / pages.length)
  const scale = pageWeightScale(pages.length, depthWeighted)

  let totalLinks = 0
  let totalWords = 0
  let failedLinks = 0
  let failedSpelling = 0

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!
    const w = weights[i]! * scale
    const linksOnPage = (page.htmlSnapshot?.match(/<a\b/gi) ?? []).length
    const broken = page.brokenLinks?.filter(l => l.status === 'broken').length ?? 0
    const spelling = page.spelling?.filter(s => s.confidence === 'error').length ?? 0
    totalLinks += linksOnPage * w
    totalWords += (page.wordCount ?? 0) * w
    failedLinks += broken * w
    failedSpelling += spelling * w
  }

  return {
    totalLinks: Math.max(0, Math.round(totalLinks)),
    totalWords: Math.max(0, Math.round(totalWords)),
    totalPages: pages.length,
    failedLinks: Math.max(0, Math.round(failedLinks)),
    failedSpelling: Math.max(0, Math.round(failedSpelling))
  }
}

export function calculateQaScore(
  failedLinks: number,
  totalLinks: number,
  failedSpelling: number,
  totalWords: number
): number {
  const linkEarned = qaPoolEarned(failedLinks, totalLinks, QA_LINK_POOL)
  const spellEarned = qaPoolEarned(failedSpelling, totalWords, QA_SPELL_POOL)
  return roundScore(linkEarned + spellEarned)
}

function qaPoolEarned(failed: number, total: number, poolPoints: number): number {
  if (total <= 0) return poolPoints
  const resolvedRatio = Math.max(0, Math.min(1, (total - failed) / total))
  return poolPoints * logarithmicProgress(resolvedRatio)
}

function elementKeyForRule(ruleId: string, elementType?: string): keyof ElementTotals | undefined {
  if (ELEMENT_DENOMINATOR_RULES[ruleId]) return ELEMENT_DENOMINATOR_RULES[ruleId]
  const guard = emptyElementTotals()
  if (elementType && elementType in guard) {
    return elementType as keyof ElementTotals
  }
  return undefined
}

function estimateTotalOccurrences(
  ruleId: string,
  failed: number,
  dismissed: number,
  elementType: string | undefined,
  elementTotals: ElementTotals | null | undefined,
  passed = 0
): number {
  const totals = elementTotals ?? emptyElementTotals()
  const passedCount = Math.max(0, passed)
  const observed = failed + dismissed + passedCount
  const key = elementKeyForRule(ruleId, elementType)
  if (key) {
    const siteTotal = totals[key]
    return Math.max(observed, siteTotal, 1)
  }
  if (passedCount > 0) return Math.max(observed, 1)
  return Math.max(failed + dismissed + 1, 1)
}

interface CheckState {
  ruleId: string
  wcagLevel: WcagLevel
  isBestPractice: boolean
  failed: number
  total: number
  weight: number
}

function issueWeight(issue: SiteimproveScoreIssue): number {
  return issue.weight ?? 1
}

function buildCheckStates(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals,
  checkStats?: A11yCheckStats | null
): CheckState[] {
  const byRule = new Map<string, { issue: SiteimproveScoreIssue, failed: number, dismissed: number }>()

  for (const issue of scoreIssues) {
    if (issue.status === 'fixed') continue
    const weight = issueWeight(issue)
    const existing = byRule.get(issue.rule_id)
    if (issue.status === 'dismissed') {
      if (existing) {
        existing.dismissed += weight
      } else {
        byRule.set(issue.rule_id, { issue, failed: 0, dismissed: weight })
      }
      continue
    }
    if (existing) {
      existing.failed += weight
    } else {
      byRule.set(issue.rule_id, { issue, failed: weight, dismissed: 0 })
    }
  }

  const fallbackCatalog = FALLBACK_AXE_CATALOG
  const catalogById = new Map(fallbackCatalog.map(entry => [entry.rule_id, entry]))
  // Always union scan catalog onto the full axe catalog so a short
  // pass/fail snapshot cannot collapse a WCAG level to one rule.
  for (const entry of checkStats?.catalog ?? []) {
    if (entry?.rule_id) catalogById.set(entry.rule_id, entry)
  }
  const ruleIds = new Set<string>([...catalogById.keys(), ...byRule.keys()])

  const checks: CheckState[] = []
  for (const ruleId of ruleIds) {
    const fromIssues = byRule.get(ruleId)
    const fromCatalog = catalogById.get(ruleId)
    const passed = checkStats?.rules?.[ruleId]?.passed ?? 0
    const failed = fromIssues?.failed ?? 0
    const dismissed = fromIssues?.dismissed ?? 0
    const wcagLevel = fromIssues?.issue.wcag_level
      ?? fromCatalog?.wcag_level
      ?? 'AA'
    const isBp = isBestPracticeRule(
      ruleId,
      fromIssues?.issue.is_best_practice ?? fromCatalog?.is_best_practice
    )
    const total = estimateTotalOccurrences(
      ruleId,
      failed,
      dismissed,
      fromIssues?.issue.element_type,
      elementTotals,
      passed
    )
    const weight = isBp ? BP_WEIGHT : LEVEL_WEIGHT[wcagLevel] ?? 1
    checks.push({
      ruleId,
      wcagLevel,
      isBestPractice: isBp,
      failed,
      total,
      weight
    })
  }

  return checks
}

function poolEarned(
  checks: CheckState[],
  poolPoints: number,
  filter: (c: CheckState) => boolean
): number {
  const pool = checks.filter(filter)
  if (!pool.length) return poolPoints
  const weightSum = pool.reduce((s, c) => s + c.weight, 0)
  if (weightSum <= 0) return poolPoints

  let earned = 0
  for (const check of pool) {
    const budget = (poolPoints * check.weight) / weightSum
    const resolvedRatio = Math.max(0, Math.min(1, (check.total - check.failed) / check.total))
    earned += budget * logarithmicProgress(resolvedRatio)
  }
  return earned
}

/** Progress toward 100% for a WCAG level (1 when no failing checks at that level). */
function levelProgress(checks: CheckState[], level: WcagLevel): number {
  const pool = checks.filter(c => !c.isBestPractice && c.wcagLevel === level)
  if (!pool.length) return 1
  let earnedWeight = 0
  let totalWeight = 0
  for (const check of pool) {
    const resolvedRatio = Math.max(0, Math.min(1, (check.total - check.failed) / check.total))
    earnedWeight += check.weight * logarithmicProgress(resolvedRatio)
    totalWeight += check.weight
  }
  if (totalWeight <= 0) return 1
  return earnedWeight / totalWeight
}

function levelScore(checks: CheckState[], level: WcagLevel): number {
  return roundScore(levelProgress(checks, level) * 100)
}

export function isAriaRule(ruleId: string): boolean {
  return ruleId.startsWith('aria-')
}

function checkPoolProgress(checks: CheckState[], filter: (c: CheckState) => boolean): number {
  const pool = checks.filter(filter)
  if (!pool.length) return 1
  let earnedWeight = 0
  let totalWeight = 0
  for (const check of pool) {
    const resolvedRatio = Math.max(0, Math.min(1, (check.total - check.failed) / check.total))
    earnedWeight += check.weight * logarithmicProgress(resolvedRatio)
    totalWeight += check.weight
  }
  if (totalWeight <= 0) return 1
  return earnedWeight / totalWeight
}

function categoryScore(checks: CheckState[], filter: (c: CheckState) => boolean): number {
  return roundScore(checkPoolProgress(checks, filter) * 100)
}

export interface TargetCategoryScores {
  levelA: number
  levelAA: number
  levelAAA: number
  aria: number
  bestPractice: number
}

export function calculateTargetCategoryScores(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals | null | undefined,
  checkStats?: A11yCheckStats | null
): TargetCategoryScores {
  const totals = elementTotals ?? emptyElementTotals()
  const active = scoreIssues.filter(i => i.status !== 'fixed')
  if (!active.length) {
    return { levelA: 100, levelAA: 100, levelAAA: 100, aria: 100, bestPractice: 100 }
  }

  const checks = buildCheckStates(active, totals, checkStats)
  if (!checks.length) {
    return { levelA: 100, levelAA: 100, levelAAA: 100, aria: 100, bestPractice: 100 }
  }

  return {
    levelA: levelScore(checks, 'A'),
    levelAA: levelScore(checks, 'AA'),
    levelAAA: levelScore(checks, 'AAA'),
    aria: ariaCategoryScore(checks),
    bestPractice: bestPracticeCategoryScore(checks)
  }
}

function ariaCategoryScore(checks: CheckState[]): number {
  const pool = checks.filter(c => c.isBestPractice && isAriaRule(c.ruleId))
  if (!pool.length) return 100
  return categoryScore(checks, c => c.isBestPractice && isAriaRule(c.ruleId))
}

/** Mirrors overall BP pool logic: no best-practice checks → 100% for the category row. */
export function bestPracticeCategoryScore(checks: CheckState[]): number {
  const pool = checks.filter(c => c.isBestPractice && !isAriaRule(c.ruleId))
  if (!pool.length) return 100
  return categoryScore(checks, c => c.isBestPractice && !isAriaRule(c.ruleId))
}

/**
 * WCAG pool (90 pts) earned from per-level progress. Each level gets a share by
 * LEVEL_WEIGHT; levels with no failing checks contribute their full share (same as levelScore).
 */
function wcagEarnedFromLevels(checks: CheckState[]): number {
  return wcagEarnedBreakdownFromChecks(checks).wcagEarned
}

export function overallScoreBreakdown(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals,
  checkStats?: A11yCheckStats | null
): OverallScoreBreakdown | null {
  const active = scoreIssues.filter(i => i.status !== 'fixed')
  if (!active.length) return null

  const checks = buildCheckStates(active, elementTotals, checkStats)
  if (!checks.length) return null

  const { levels, wcagEarned, totalLevelWeight } = wcagEarnedBreakdownFromChecks(checks)
  const bpEarned = poolEarned(checks, BP_POOL, c => c.isBestPractice)
  const bpChecks = checks.filter(c => c.isBestPractice)
  const bpEarnedAdjusted = bpChecks.length ? bpEarned : BP_POOL

  return {
    levels,
    totalLevelWeight,
    wcagEarned: roundScore(wcagEarned),
    bpEarned: roundScore(bpEarned),
    bpEarnedAdjusted: roundScore(bpEarnedAdjusted),
    overall: roundScore(wcagEarned + bpEarnedAdjusted)
  }
}

export function logOverallScoreBreakdown(
  label: string,
  breakdown: OverallScoreBreakdown,
  storedOverall?: number | null
): void {
  const levelLines = breakdown.levels.map((detail) => {
    return (
      `${detail.level}: weight=${detail.levelWeight} share=${detail.shareOfWcagPool} ` +
      `progress=${detail.progress} levelScore=${detail.levelScore} earned=${detail.earned}`
    )
  })
  const storedNote = storedOverall != null
    ? ` stored=${storedOverall} delta=${roundScore(breakdown.overall - storedOverall)}`
    : ''
  console.log(
    `[overallScore] ${label}${storedNote}\n` +
    `  levels:\n    ${levelLines.join('\n    ')}\n` +
    `  wcagEarned=${breakdown.wcagEarned} bpEarned=${breakdown.bpEarned} ` +
    `bpAdjusted=${breakdown.bpEarnedAdjusted} overall=${breakdown.overall}`
  )
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10
}

export function formatAccessibilityScore(score: number): string {
  const rounded = roundScore(score)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Donut ring colour: 0–49 red, 50–74 amber, 75–100 green. */
export function scoreRingColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

/** Very dark backdrop matching scoreRingColor. Keeps score text readable. */
export function scoreTextBackdrop(score: number): string {
  if (score >= 75) return '#052e16'
  if (score >= 50) return '#451a03'
  return '#450a0a'
}

/**
 * Solid fill for score chips on hover. Darkened so white text stays WCAG AA.
 * Thresholds match scoreRingColor (green / amber / red).
 */
export function scoreHoverFill(score: number): string {
  if (score >= 75) return '#15803d' // green-700
  if (score >= 50) return '#b45309' // amber-700
  return '#b91c1c' // red-700
}

export interface WcagLevelEarnedDetail {
  level: WcagLevel
  levelWeight: number
  shareOfWcagPool: number
  progress: number
  levelScore: number
  earned: number
}

export interface OverallScoreBreakdown {
  levels: WcagLevelEarnedDetail[]
  totalLevelWeight: number
  wcagEarned: number
  bpEarned: number
  bpEarnedAdjusted: number
  overall: number
}

function wcagEarnedBreakdownFromChecks(checks: CheckState[]): {
  levels: WcagLevelEarnedDetail[]
  wcagEarned: number
  totalLevelWeight: number
} {
  const levels: WcagLevel[] = ['A', 'AA', 'AAA']
  const totalLevelWeight = levels.reduce((sum, level) => sum + LEVEL_WEIGHT[level], 0)
  const details: WcagLevelEarnedDetail[] = []
  let wcagEarned = 0

  for (const level of levels) {
    const progress = levelProgress(checks, level)
    const share = (LEVEL_WEIGHT[level] / totalLevelWeight) * WCAG_POOL
    const earned = share * progress
    wcagEarned += earned
    details.push({
      level,
      levelWeight: LEVEL_WEIGHT[level],
      shareOfWcagPool: roundScore(share),
      progress: roundScore(progress * 100) / 100,
      levelScore: levelScore(checks, level),
      earned: roundScore(earned)
    })
  }

  return { levels: details, wcagEarned, totalLevelWeight }
}

export function calculateSiteimproveScores(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals,
  checkStats?: A11yCheckStats | null
): SiteimproveScores {
  const active = scoreIssues.filter(i => i.status !== 'fixed')
  if (!active.length) {
    return { overall: 100, levelA: 100, levelAA: 100, levelAAA: 100 }
  }

  const checks = buildCheckStates(active, elementTotals, checkStats)
  if (!checks.length) {
    return { overall: 100, levelA: 100, levelAA: 100, levelAAA: 100 }
  }

  const wcagEarned = wcagEarnedFromLevels(checks)
  const bpEarned = poolEarned(checks, BP_POOL, c => c.isBestPractice)
  const bpChecks = checks.filter(c => c.isBestPractice)
  const bpEarnedAdjusted = bpChecks.length ? bpEarned : BP_POOL

  return {
    overall: roundScore(wcagEarned + bpEarnedAdjusted),
    levelA: levelScore(checks, 'A'),
    levelAA: levelScore(checks, 'AA'),
    levelAAA: levelScore(checks, 'AAA')
  }
}

/** Fallback when cached denominators are unavailable (legacy / pre-scan). */
export function estimateElementTotalsFromIssues(
  scoreIssues: SiteimproveScoreIssue[]
): ElementTotals {
  const totals = emptyElementTotals()
  for (const issue of scoreIssues) {
    if (issue.status === 'fixed') continue
    const key = elementKeyForRule(issue.rule_id, issue.element_type)
      ?? (issue.element_type && issue.element_type in totals
        ? issue.element_type as keyof ElementTotals
        : undefined)
    if (key) totals[key] += issueWeight(issue)
  }
  for (const key of Object.keys(totals) as (keyof ElementTotals)[]) {
    if (totals[key] > 0) {
      totals[key] = Math.max(totals[key] * 2, totals[key] + 5)
    }
  }
  return totals
}

/** Prefer the larger per-type count when HTML snapshots may be truncated on re-aggregate. */
export function mergeElementTotalsMax(a: ElementTotals, b: ElementTotals): ElementTotals {
  const result = emptyElementTotals()
  for (const key of Object.keys(result) as (keyof ElementTotals)[]) {
    result[key] = Math.max(a[key] ?? 0, b[key] ?? 0)
  }
  return result
}

export function resolveElementTotals(
  cached: ElementTotals | undefined | null,
  scoreIssues: SiteimproveScoreIssue[]
): ElementTotals {
  const estimated = estimateElementTotalsFromIssues(scoreIssues)
  if (cached && Object.values(cached).some(v => v > 0)) {
    return mergeElementTotalsMax({ ...emptyElementTotals(), ...cached }, estimated)
  }
  return estimated
}

function scoreableIssues(issues: SiteimproveScoreIssue[]): SiteimproveScoreIssue[] {
  return issues.filter(i => i.status !== 'fixed')
}

/** Marginal points from resolving one occurrence of a rule. */
export function pointsToGainForRule(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals,
  ruleId: string,
  checkStats?: A11yCheckStats | null
): number {
  const active = scoreableIssues(scoreIssues)
  if (!active.some(i => i.rule_id === ruleId && i.status !== 'dismissed')) return 0

  const before = calculateSiteimproveScores(active, elementTotals, checkStats).overall

  const afterIssues = [...active]
  let removed = false
  for (let i = afterIssues.length - 1; i >= 0; i--) {
    const issue = afterIssues[i]!
    if (issue.rule_id === ruleId && issue.status !== 'dismissed') {
      afterIssues.splice(i, 1)
      removed = true
      break
    }
  }
  if (!removed) return 0

  const after = calculateSiteimproveScores(afterIssues, elementTotals, checkStats).overall
  return Math.max(0, roundScore(after - before))
}

/** Points available if all open occurrences of a rule were resolved. */
export function pointsToGainIfAllResolvedForRule(
  scoreIssues: SiteimproveScoreIssue[],
  elementTotals: ElementTotals,
  ruleId: string,
  checkStats?: A11yCheckStats | null
): number {
  const active = scoreableIssues(scoreIssues)
  if (!active.some(i => i.rule_id === ruleId && i.status !== 'dismissed')) return 0

  const before = calculateSiteimproveScores(active, elementTotals, checkStats).overall
  const afterIssues = active.filter(i => !(i.rule_id === ruleId && i.status !== 'dismissed'))
  const after = calculateSiteimproveScores(afterIssues, elementTotals, checkStats).overall
  return Math.max(0, roundScore(after - before))
}
