import type { Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import { isValidCssSelector } from '../qa/cssSelector.js'
import {
  mapAxeTagsToWcagLevel,
  extractWcagSc,
  extractWcagVersion,
  mapElementType,
  mapResponsibleRole,
  mapIssueType,
  normalizeImpact
} from './wcagMapper.js'
import { optionalHttpUrl } from '../db/recordSanitize.js'
import {
  type A11yCheckCatalogEntry,
  type A11yCheckStats
} from './a11yCheckStats.js'

export const DEFAULT_AXE_TAGS = [
  'wcag2a', 'wcag2aa', 'wcag2aaa',
  'wcag21a', 'wcag21aa', 'wcag21aaa',
  'wcag22a', 'wcag22aa', 'wcag22aaa',
  'best-practice'
]

export interface AxeIssueRecord {
  rule_id: string
  wcag_level: string
  wcag_sc: string
  wcag_version: string
  impact: string
  type: string
  element_type: string
  responsible_role: string
  help_url?: string
  description: string
  html_snippet: string
  css_selector: string
  fix_suggestion: string
  status: string
}

export interface RunAxeOptions {
  tags?: string[]
  /** CSS selectors passed to AxeBuilder.exclude() (third-party embeds, widgets, etc.). */
  excludeSelectors?: string[]
}

export interface AxeRunResult {
  issues: AxeIssueRecord[]
  checkStats: A11yCheckStats
}

interface AxeRuleGroup {
  id: string
  tags?: string[]
  nodes?: unknown[]
}

interface AxeAnalyzeShape {
  violations?: AxeRuleGroup[]
  passes?: AxeRuleGroup[]
  incomplete?: AxeRuleGroup[]
  inapplicable?: AxeRuleGroup[]
}

const WCAG_LEVEL_TAGS = new Set([
  'wcag2a', 'wcag2aa', 'wcag2aaa',
  'wcag21a', 'wcag21aa', 'wcag21aaa',
  'wcag22a', 'wcag22aa', 'wcag22aaa'
])

function catalogEntryFromAxeRule(rule: AxeRuleGroup): A11yCheckCatalogEntry {
  const tags = rule.tags ?? []
  return {
    rule_id: rule.id,
    wcag_level: mapAxeTagsToWcagLevel(tags),
    is_best_practice: tags.includes('best-practice') && !tags.some(tag => WCAG_LEVEL_TAGS.has(tag))
  }
}

export function checkStatsFromAxeResults(results: AxeAnalyzeShape): A11yCheckStats {
  const catalog: A11yCheckCatalogEntry[] = []
  const seen = new Set<string>()
  const rules: A11yCheckStats['rules'] = {}

  const addGroup = (group: AxeRuleGroup[] | undefined, field: 'failed' | 'passed' | 'incomplete') => {
    for (const rule of group ?? []) {
      if (!rule?.id) continue
      if (!seen.has(rule.id)) {
        seen.add(rule.id)
        catalog.push(catalogEntryFromAxeRule(rule))
      }
      const existing = rules[rule.id] ?? { failed: 0, passed: 0, incomplete: 0 }
      existing[field] += Array.isArray(rule.nodes) ? rule.nodes.length : 0
      rules[rule.id] = existing
    }
  }

  addGroup(results.violations, 'failed')
  addGroup(results.passes, 'passed')
  addGroup(results.incomplete, 'incomplete')
  addGroup(results.inapplicable, 'passed')

  return { catalog, rules }
}

/** Apply CSS exclude selectors to an Axe builder (exported for unit tests). */
export function applyAxeExcludeSelectors<T extends { exclude: (selector: string) => T }>(
  builder: T,
  excludeSelectors: string[] | undefined
): T {
  if (!excludeSelectors?.length) return builder
  let next = builder
  for (const selector of excludeSelectors) {
    const trimmed = selector.trim()
    if (!trimmed) continue
    if (!isValidCssSelector(trimmed)) {
      console.warn(`Skipping invalid axe exclude selector: ${trimmed}`)
      continue
    }
    next = next.exclude(trimmed)
  }
  return next
}

export async function runAxeOnPage(
  page: Page,
  tagsOrOptions: string[] | RunAxeOptions = DEFAULT_AXE_TAGS,
  maybeOptions?: RunAxeOptions
): Promise<AxeRunResult> {
  const options: RunAxeOptions = Array.isArray(tagsOrOptions)
    ? { tags: tagsOrOptions, ...maybeOptions }
    : { ...tagsOrOptions }
  const tags = options.tags?.length ? options.tags : DEFAULT_AXE_TAGS

  let builder = new AxeBuilder({ page }).withTags(tags)
  builder = applyAxeExcludeSelectors(builder, options.excludeSelectors)
  const results = await builder.analyze()

  const issues: AxeIssueRecord[] = []

  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const html = node.html || ''
      const elementType = mapElementType(violation.id, html)
      const impact = normalizeImpact(violation.impact)
      const helpUrl = optionalHttpUrl(violation.helpUrl)
      issues.push({
        rule_id: violation.id,
        wcag_level: mapAxeTagsToWcagLevel(violation.tags),
        wcag_sc: extractWcagSc(violation.tags),
        wcag_version: extractWcagVersion(violation.tags),
        impact,
        type: mapIssueType(impact, false),
        element_type: elementType,
        responsible_role: mapResponsibleRole(violation.id, elementType),
        ...(helpUrl ? { help_url: helpUrl } : {}),
        description: violation.help || violation.description,
        html_snippet: html.slice(0, 5000),
        css_selector: node.target?.join(', ') || '',
        fix_suggestion: buildFixSuggestion(node),
        status: 'open'
      })
    }
  }

  for (const incomplete of results.incomplete) {
    for (const node of incomplete.nodes) {
      const html = node.html || ''
      const elementType = mapElementType(incomplete.id, html)
      const impact = normalizeImpact(incomplete.impact)
      const helpUrl = optionalHttpUrl(incomplete.helpUrl)
      issues.push({
        rule_id: incomplete.id,
        wcag_level: mapAxeTagsToWcagLevel(incomplete.tags),
        wcag_sc: extractWcagSc(incomplete.tags),
        wcag_version: extractWcagVersion(incomplete.tags),
        impact,
        type: 'review',
        element_type: elementType,
        responsible_role: mapResponsibleRole(incomplete.id, elementType),
        ...(helpUrl ? { help_url: helpUrl } : {}),
        description: incomplete.help || incomplete.description,
        html_snippet: html.slice(0, 5000),
        css_selector: node.target?.join(', ') || '',
        fix_suggestion: buildFixSuggestion(node),
        status: 'open'
      })
    }
  }

  return {
    issues,
    checkStats: checkStatsFromAxeResults(results)
  }
}

export function buildFixSuggestion(node: { any?: Array<{ message: string }>, all?: Array<{ message: string }>, none?: Array<{ message: string }> }): string {
  const parts = [
    ...(node.any || []).map(c => c.message),
    ...(node.all || []).map(c => c.message),
    ...(node.none || []).map(c => c.message)
  ]
  return parts.join(' | ') || 'See help URL for guidance.'
}
