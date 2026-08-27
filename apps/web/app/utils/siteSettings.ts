import type { AccessibilityIssue, Site } from '~/types/sitenook'
import {
  coerceReadabilityMethods,
  DEFAULT_READABILITY_METHODS,
  type ReadabilityMethodId
} from '~/utils/readabilityMethods'
import { isAriaRule, isBestPracticeRule } from '~/utils/siteimproveScore'

export type WcagVersionTarget = '2.0' | '2.1' | '2.2'
export type WcagConformanceTarget = 'A' | 'AA' | 'AAA'

export interface SiteSettings {
  wcagVersion: WcagVersionTarget
  /** Target conformance level (includes all lower levels). */
  wcagConformance: WcagConformanceTarget
  ariaConformance: boolean
  bestPractices: boolean
  includeIssues: boolean
  includePotentialIssues: boolean
  checkLinks: boolean
  checkSpelling: boolean
  spellLanguage: string
  checkReadability: boolean
  /** Single readability test shown on the Accessibility → Readability page. */
  readabilityMethods: ReadabilityMethodId[]
  runPolicies: boolean
  notifyEmail: string | null
  diffFromPrevious: boolean
  /** Weight shallow pages more heavily when aggregating scan scores. */
  depthWeightedScoring: boolean
  checkSeo: boolean
  checkStructuredData: boolean
  seoTitleMinLength: number
  seoTitleMaxLength: number
  seoDescMinLength: number
  seoDescMaxLength: number
  thinContentWordThreshold: number
  lowReadabilityThreshold: number
}

export type IssueTargetCategory = 'wcag' | 'aria' | 'best_practice'

const WCAG_VERSION_RANK: Record<WcagVersionTarget, number> = {
  '2.0': 0,
  '2.1': 1,
  '2.2': 2
}

export function getDefaultSiteSettings(): SiteSettings {
  return {
    wcagVersion: '2.2',
    wcagConformance: 'AA',
    ariaConformance: true,
    bestPractices: true,
    includeIssues: true,
    includePotentialIssues: true,
    checkLinks: true,
    checkSpelling: true,
    spellLanguage: 'en-AU',
    checkReadability: true,
    readabilityMethods: [...DEFAULT_READABILITY_METHODS],
    runPolicies: true,
    notifyEmail: null,
    diffFromPrevious: true,
    depthWeightedScoring: false,
    checkSeo: true,
    checkStructuredData: true,
    seoTitleMinLength: 30,
    seoTitleMaxLength: 60,
    seoDescMinLength: 70,
    seoDescMaxLength: 160,
    thinContentWordThreshold: 300,
    lowReadabilityThreshold: 50
  }
}

function coerceConformance(value: unknown): WcagConformanceTarget {
  if (value === 'A' || value === 'AA' || value === 'AAA') return value
  return 'AA'
}

function coerceWcagVersion(value: unknown): WcagVersionTarget {
  if (value === '2.0' || value === '2.1' || value === '2.2') return value
  return '2.2'
}

/** Derive site target from legacy default_scan_config when site_settings is missing. */
export function siteSettingsFromLegacyScanConfig(raw: unknown): Partial<SiteSettings> {
  if (!raw || typeof raw !== 'object') return {}
  const data = raw as Record<string, unknown>
  const levels = Array.isArray(data.wcagLevels) ? data.wcagLevels as string[] : []
  let wcagConformance: WcagConformanceTarget = 'AA'
  if (levels.includes('AAA')) wcagConformance = 'AAA'
  else if (levels.includes('AA')) wcagConformance = 'AA'
  else if (levels.includes('A')) wcagConformance = 'A'

  return {
    wcagVersion: coerceWcagVersion(data.wcagVersion),
    wcagConformance,
    ariaConformance: true,
    bestPractices: data.bestPractices !== false,
    includeIssues: true,
    includePotentialIssues: true,
    checkLinks: data.checkLinks !== false,
    checkSpelling: data.checkSpelling !== false,
    spellLanguage: typeof data.spellLanguage === 'string' ? data.spellLanguage : 'en-AU',
    checkReadability: data.checkReadability !== false,
    runPolicies: data.runPolicies !== false,
    notifyEmail: typeof data.notifyEmail === 'string' ? data.notifyEmail : null,
    diffFromPrevious: data.diffFromPrevious !== false
  }
}

function hasStoredSiteSettings(raw: unknown): raw is Partial<SiteSettings> {
  return !!raw && typeof raw === 'object' && Object.keys(raw as object).length > 0
}

export function parseSiteSettings(
  raw: unknown,
  legacyScanConfig?: unknown
): SiteSettings {
  const defaults = getDefaultSiteSettings()

  if (hasStoredSiteSettings(raw)) {
    const data = raw
    return {
      ...defaults,
      wcagVersion: coerceWcagVersion(data.wcagVersion),
      wcagConformance: coerceConformance(data.wcagConformance),
      ariaConformance: data.ariaConformance ?? defaults.ariaConformance,
      bestPractices: data.bestPractices ?? defaults.bestPractices,
      includeIssues: data.includeIssues ?? defaults.includeIssues,
      includePotentialIssues: data.includePotentialIssues ?? defaults.includePotentialIssues,
      checkLinks: data.checkLinks ?? defaults.checkLinks,
      checkSpelling: data.checkSpelling ?? defaults.checkSpelling,
      spellLanguage: data.spellLanguage ?? defaults.spellLanguage,
      checkReadability: data.checkReadability ?? defaults.checkReadability,
      readabilityMethods: coerceReadabilityMethods(data.readabilityMethods),
      runPolicies: data.runPolicies ?? defaults.runPolicies,
      notifyEmail: data.notifyEmail !== undefined ? data.notifyEmail : defaults.notifyEmail,
      diffFromPrevious: data.diffFromPrevious ?? defaults.diffFromPrevious,
      depthWeightedScoring: data.depthWeightedScoring ?? defaults.depthWeightedScoring,
      checkSeo: data.checkSeo ?? defaults.checkSeo,
      checkStructuredData: data.checkStructuredData ?? defaults.checkStructuredData,
      seoTitleMinLength: data.seoTitleMinLength ?? defaults.seoTitleMinLength,
      seoTitleMaxLength: data.seoTitleMaxLength ?? defaults.seoTitleMaxLength,
      seoDescMinLength: data.seoDescMinLength ?? defaults.seoDescMinLength,
      seoDescMaxLength: data.seoDescMaxLength ?? defaults.seoDescMaxLength,
      thinContentWordThreshold: data.thinContentWordThreshold ?? defaults.thinContentWordThreshold,
      lowReadabilityThreshold: data.lowReadabilityThreshold ?? defaults.lowReadabilityThreshold
    }
  }

  const legacy = siteSettingsFromLegacyScanConfig(legacyScanConfig)
  return {
    ...defaults,
    ...legacy,
    wcagVersion: coerceWcagVersion(legacy.wcagVersion),
    wcagConformance: coerceConformance(legacy.wcagConformance),
    ariaConformance: legacy.ariaConformance ?? defaults.ariaConformance,
    bestPractices: legacy.bestPractices ?? defaults.bestPractices,
    includeIssues: defaults.includeIssues,
    includePotentialIssues: defaults.includePotentialIssues,
    checkLinks: legacy.checkLinks ?? defaults.checkLinks,
    checkSpelling: legacy.checkSpelling ?? defaults.checkSpelling,
    spellLanguage: legacy.spellLanguage ?? defaults.spellLanguage,
    checkReadability: legacy.checkReadability ?? defaults.checkReadability,
    readabilityMethods: defaults.readabilityMethods,
    runPolicies: legacy.runPolicies ?? defaults.runPolicies,
    notifyEmail: legacy.notifyEmail ?? defaults.notifyEmail,
    diffFromPrevious: legacy.diffFromPrevious ?? defaults.diffFromPrevious,
    depthWeightedScoring: defaults.depthWeightedScoring
  }
}

export function serializeSiteSettings(settings: SiteSettings): Record<string, unknown> {
  // Explicit plain object — structuredClone/toRaw fail on Vue reactive proxies.
  return {
    wcagVersion: settings.wcagVersion,
    wcagConformance: settings.wcagConformance,
    ariaConformance: settings.ariaConformance,
    bestPractices: settings.bestPractices,
    includeIssues: settings.includeIssues,
    includePotentialIssues: settings.includePotentialIssues,
    checkLinks: settings.checkLinks,
    checkSpelling: settings.checkSpelling,
    spellLanguage: settings.spellLanguage,
    checkReadability: settings.checkReadability,
    readabilityMethods: settings.readabilityMethods,
    runPolicies: settings.runPolicies,
    notifyEmail: settings.notifyEmail,
    diffFromPrevious: settings.diffFromPrevious,
    depthWeightedScoring: settings.depthWeightedScoring
  }
}

export function siteSettingsForSite(site: Site | null | undefined): SiteSettings {
  if (!site) return getDefaultSiteSettings()
  return parseSiteSettings(site.site_settings, site.default_scan_config)
}

export function levelsForConformance(target: WcagConformanceTarget): WcagConformanceTarget[] {
  if (target === 'A') return ['A']
  if (target === 'AA') return ['A', 'AA']
  return ['A', 'AA', 'AAA']
}

export function issueMatchesWcagVersion(
  issueVersion: string | undefined,
  targetVersion: WcagVersionTarget
): boolean {
  if (!issueVersion) return true
  const issueRank = WCAG_VERSION_RANK[issueVersion as WcagVersionTarget]
  const targetRank = WCAG_VERSION_RANK[targetVersion]
  if (issueRank === undefined || targetRank === undefined) return true
  return issueRank <= targetRank
}

import type { SiteSettings } from '~/utils/siteSettings'
import type { A11ySiteTargetSnapshot } from '~/utils/a11ySummary'

export function siteTargetSnapshot(settings: SiteSettings): A11ySiteTargetSnapshot {
  return {
    wcagVersion: settings.wcagVersion,
    wcagConformance: settings.wcagConformance,
    ariaConformance: settings.ariaConformance,
    bestPractices: settings.bestPractices,
    includeIssues: settings.includeIssues,
    includePotentialIssues: settings.includePotentialIssues
  }
}

export function siteTargetSnapshotsEqual(
  stored: A11ySiteTargetSnapshot | undefined,
  settings: SiteSettings
): boolean {
  if (!stored) return false
  const current = siteTargetSnapshot(settings)
  return (
    stored.wcagVersion === current.wcagVersion
    && stored.wcagConformance === current.wcagConformance
    && stored.ariaConformance === current.ariaConformance
    && stored.bestPractices === current.bestPractices
    && stored.includeIssues === current.includeIssues
    && stored.includePotentialIssues === current.includePotentialIssues
  )
}

export function classifyIssueCategory(issue: {
  rule_id: string
  wcag_sc?: string
  element_type?: string
}): IssueTargetCategory {
  // Align with score pools (ariaCategoryScore / bestPracticeCategoryScore):
  // only axe best-practice aria-* rules belong to ARIA; WCAG aria-* stay wcag.
  if (isAriaRule(issue.rule_id) && isBestPracticeRule(issue.rule_id)) return 'aria'
  if (isBestPracticeRule(issue.rule_id)) return 'best_practice'
  return 'wcag'
}

export function issueInSiteTarget(
  issue: Pick<AccessibilityIssue, 'rule_id' | 'wcag_level' | 'wcag_version' | 'wcag_sc' | 'element_type' | 'type'>,
  settings: SiteSettings
): boolean {
  const isPotential = issue.type === 'review'
  if (isPotential && !settings.includePotentialIssues) return false
  if (!isPotential && !settings.includeIssues) return false

  const category = classifyIssueCategory(issue)
  if (category === 'best_practice') return settings.bestPractices
  if (category === 'aria') return settings.ariaConformance

  if (!issueMatchesWcagVersion(issue.wcag_version, settings.wcagVersion)) return false
  return levelsForConformance(settings.wcagConformance).includes(issue.wcag_level)
}

export interface SiteTargetRow {
  label: string
  value: string
  enabled?: boolean
}

const SPELL_LANGUAGE_LABELS: Record<string, string> = {
  'en-AU': 'English (AU)',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  fr: 'French',
  de: 'German',
  es: 'Spanish'
}

export type AccessibilityScoreCategoryId = 'A' | 'AA' | 'AAA' | 'aria' | 'best_practice'

export interface AccessibilityScoreDetailRow {
  id: AccessibilityScoreCategoryId
  badge: string
  badgeClass: string
  label: string
}

const WCAG_LEVEL_DETAIL: Record<
  WcagConformanceTarget,
  Pick<AccessibilityScoreDetailRow, 'badge' | 'badgeClass' | 'label'>
> = {
  A: { badge: 'A', badgeClass: 'site-target-badge--a', label: 'Level A' },
  AA: { badge: 'AA', badgeClass: 'site-target-badge--aa', label: 'Level AA' },
  AAA: { badge: 'AAA', badgeClass: 'site-target-badge--aaa', label: 'Level AAA' }
}

/** Score-detail rows for levels/categories included in the site accessibility target. */
export function accessibilityScoreDetailRows(settings: SiteSettings): AccessibilityScoreDetailRow[] {
  const rows: AccessibilityScoreDetailRow[] = []
  for (const level of levelsForConformance(settings.wcagConformance)) {
    rows.push({ id: level, ...WCAG_LEVEL_DETAIL[level] })
  }
  if (settings.ariaConformance) {
    rows.push({
      id: 'aria',
      badge: 'ARIA',
      badgeClass: 'site-target-badge--aria',
      label: 'WAI-ARIA authoring practices'
    })
  }
  if (settings.bestPractices) {
    rows.push({
      id: 'best_practice',
      badge: 'S',
      badgeClass: 'site-target-badge--bp',
      label: 'Accessibility best practices'
    })
  }
  return rows
}

export function accessibilityTargetRows(settings: SiteSettings): SiteTargetRow[] {
  return [
    { label: 'WCAG version', value: settings.wcagVersion },
    { label: 'Conformance', value: settings.wcagConformance },
    {
      label: 'ARIA',
      value: settings.ariaConformance ? 'Included' : 'Excluded',
      enabled: settings.ariaConformance
    },
    {
      label: 'Best practices',
      value: settings.bestPractices ? 'Included' : 'Excluded',
      enabled: settings.bestPractices
    },
    {
      label: 'Confirmed issues',
      value: settings.includeIssues ? 'Shown' : 'Hidden',
      enabled: settings.includeIssues
    },
    {
      label: 'Potential issues',
      value: settings.includePotentialIssues ? 'Shown' : 'Hidden',
      enabled: settings.includePotentialIssues
    },
    {
      label: 'Page depth weighting',
      value: settings.depthWeightedScoring ? 'Shallow pages weighted higher' : 'All pages equal',
      enabled: settings.depthWeightedScoring
    }
  ]
}

export interface QaTargetBadgeItem {
  id: string
  icon: string
  label: string
  enabled: boolean
}

export function qaTargetBadgeItems(settings: SiteSettings): QaTargetBadgeItem[] {
  return [
    {
      id: 'links',
      icon: 'i-lucide-unlink',
      label: 'Broken links',
      enabled: settings.checkLinks
    },
    {
      id: 'spelling',
      icon: 'i-lucide-spell-check',
      label: 'Spell check',
      enabled: settings.checkSpelling
    },
    {
      id: 'readability',
      icon: 'i-lucide-book-open-text',
      label: 'Readability',
      enabled: settings.checkReadability
    },
    {
      id: 'policies',
      icon: 'i-lucide-shield-alert',
      label: 'Custom policies',
      enabled: settings.runPolicies
    }
  ]
}

export function qaTargetRows(settings: SiteSettings): SiteTargetRow[] {
  const spellLabel = SPELL_LANGUAGE_LABELS[settings.spellLanguage] ?? settings.spellLanguage
  return [
    {
      label: 'Broken links',
      value: settings.checkLinks ? 'Shown in reports' : 'Hidden from reports',
      enabled: settings.checkLinks
    },
    {
      label: 'Spell check',
      value: settings.checkSpelling ? spellLabel : 'Off',
      enabled: settings.checkSpelling
    },
    {
      label: 'Readability',
      value: settings.checkReadability ? 'Shown in reports' : 'Hidden from reports',
      enabled: settings.checkReadability
    },
    {
      label: 'Custom policies',
      value: settings.runPolicies ? 'Shown in reports' : 'Hidden from reports',
      enabled: settings.runPolicies
    }
  ]
}

export function accessibilityTargetSummary(settings: SiteSettings): string {
  const bp = settings.bestPractices ? 'Best practices on' : 'Best practices off'
  const aria = settings.ariaConformance ? 'ARIA on' : 'ARIA off'
  return `WCAG ${settings.wcagVersion} · ${settings.wcagConformance} · ${aria} · ${bp}`
}

export function qaTargetSummary(settings: SiteSettings): string {
  const parts: string[] = []
  if (settings.checkLinks) parts.push('Links')
  if (settings.checkSpelling) parts.push('Spelling')
  if (settings.checkReadability) parts.push('Readability')
  if (settings.runPolicies) parts.push('Policies')
  return parts.length ? parts.join(', ') : 'None'
}

export function notificationsTargetSummary(settings: SiteSettings): string {
  const parts: string[] = []
  if (settings.notifyEmail) parts.push('Email on')
  if (settings.diffFromPrevious) parts.push('Diff on')
  return parts.length ? parts.join(' · ') : 'Defaults'
}
