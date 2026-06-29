import type { Page } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
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

export async function runAxeOnPage(page: Page, tags = DEFAULT_AXE_TAGS): Promise<AxeIssueRecord[]> {
  const results = await new AxeBuilder({ page })
    .withTags(tags.length ? tags : DEFAULT_AXE_TAGS)
    .analyze()

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

  return issues
}

export function buildFixSuggestion(node: { any?: Array<{ message: string }>, all?: Array<{ message: string }>, none?: Array<{ message: string }> }): string {
  const parts = [
    ...(node.any || []).map(c => c.message),
    ...(node.all || []).map(c => c.message),
    ...(node.none || []).map(c => c.message)
  ]
  return parts.join(' | ') || 'See help URL for guidance.'
}
