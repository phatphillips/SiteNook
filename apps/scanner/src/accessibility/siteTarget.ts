import type { WcagConformanceTarget, WcagVersionTarget } from './siteTargetTypes.js'
import { isAriaRule, isBestPracticeRule } from './siteimproveScore.js'

export type { WcagConformanceTarget, WcagVersionTarget } from './siteTargetTypes.js'

export interface SiteTargetSettings {
  wcagVersion: WcagVersionTarget
  wcagConformance: WcagConformanceTarget
  ariaConformance: boolean
  bestPractices: boolean
  includeIssues: boolean
  includePotentialIssues: boolean
}

export interface SiteTargetIssueInput {
  rule_id: string
  wcag_level: string
  wcag_version?: string
  wcag_sc?: string
  element_type?: string
  type?: string
}

const WCAG_VERSION_RANK: Record<WcagVersionTarget, number> = {
  '2.0': 0,
  '2.1': 1,
  '2.2': 2
}

export function levelsForConformance(target: WcagConformanceTarget): WcagConformanceTarget[] {
  if (target === 'A') return ['A']
  if (target === 'AA') return ['A', 'AA']
  return ['A', 'AA', 'AAA']
}

function issueMatchesWcagVersion(issueVersion: string | undefined, targetVersion: WcagVersionTarget): boolean {
  if (!issueVersion) return true
  const issueRank = WCAG_VERSION_RANK[issueVersion as WcagVersionTarget]
  const targetRank = WCAG_VERSION_RANK[targetVersion]
  if (issueRank === undefined || targetRank === undefined) return true
  return issueRank <= targetRank
}

export function classifyIssueCategory(issue: {
  rule_id: string
  wcag_sc?: string
  element_type?: string
}): 'wcag' | 'aria' | 'best_practice' {
  // Align with score pools: only axe best-practice aria-* → aria; WCAG aria-* stay wcag.
  if (isAriaRule(issue.rule_id) && isBestPracticeRule(issue.rule_id)) return 'aria'
  if (isBestPracticeRule(issue.rule_id)) return 'best_practice'
  return 'wcag'
}

export function issueInSiteTarget(issue: SiteTargetIssueInput, settings: SiteTargetSettings): boolean {
  const isPotential = issue.type === 'review'
  if (isPotential && !settings.includePotentialIssues) return false
  if (!isPotential && !settings.includeIssues) return false

  const category = classifyIssueCategory(issue)
  if (category === 'best_practice') return settings.bestPractices
  if (category === 'aria') return settings.ariaConformance

  if (!issueMatchesWcagVersion(issue.wcag_version, settings.wcagVersion)) return false
  return levelsForConformance(settings.wcagConformance).includes(issue.wcag_level as WcagConformanceTarget)
}

function coerceConformance(value: unknown): WcagConformanceTarget {
  if (value === 'A' || value === 'AA' || value === 'AAA') return value
  return 'AA'
}

function coerceWcagVersion(value: unknown): WcagVersionTarget {
  if (value === '2.0' || value === '2.1' || value === '2.2') return value
  return '2.2'
}

export function parseSiteTargetSettings(
  siteSettings?: Record<string, unknown> | null,
  legacyScanConfig?: Record<string, unknown> | null
): SiteTargetSettings {
  const raw = siteSettings && Object.keys(siteSettings).length ? siteSettings : null
  const levels = Array.isArray(legacyScanConfig?.wcagLevels)
    ? legacyScanConfig.wcagLevels as string[]
    : []

  let legacyConformance: WcagConformanceTarget = 'AA'
  if (levels.includes('AAA')) legacyConformance = 'AAA'
  else if (levels.includes('AA')) legacyConformance = 'AA'
  else if (levels.includes('A')) legacyConformance = 'A'

  return {
    wcagVersion: coerceWcagVersion(raw?.wcagVersion ?? legacyScanConfig?.wcagVersion),
    wcagConformance: coerceConformance(raw?.wcagConformance ?? legacyConformance),
    ariaConformance: raw?.ariaConformance !== false,
    bestPractices: raw?.bestPractices ?? legacyScanConfig?.bestPractices !== false,
    includeIssues: raw?.includeIssues !== false,
    includePotentialIssues: raw?.includePotentialIssues !== false
  }
}

export function siteTargetSnapshot(settings: SiteTargetSettings) {
  return { ...settings }
}

export function siteTargetSnapshotsEqual(
  stored: SiteTargetSettings | undefined,
  settings: SiteTargetSettings
): boolean {
  if (!stored) return false
  return (
    stored.wcagVersion === settings.wcagVersion
    && stored.wcagConformance === settings.wcagConformance
    && stored.ariaConformance === settings.ariaConformance
    && stored.bestPractices === settings.bestPractices
    && stored.includeIssues === settings.includeIssues
    && stored.includePotentialIssues === settings.includePotentialIssues
  )
}
