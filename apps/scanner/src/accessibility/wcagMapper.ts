const WCAG_LEVEL_MAP: Record<string, 'A' | 'AA' | 'AAA'> = {
  wcag2a: 'A',
  wcag21a: 'A',
  wcag22a: 'A',
  wcag2aa: 'AA',
  wcag21aa: 'AA',
  wcag22aa: 'AA',
  wcag2aaa: 'AAA',
  wcag21aaa: 'AAA',
  wcag22aaa: 'AAA'
}

const SC_PATTERN = /wcag(\d)(\d)(\d+)/

export function mapAxeTagsToWcagLevel(tags: string[]): 'A' | 'AA' | 'AAA' {
  for (const tag of tags) {
    if (WCAG_LEVEL_MAP[tag]) return WCAG_LEVEL_MAP[tag]
  }
  return 'AA'
}

export function extractWcagSc(tags: string[]): string {
  for (const tag of tags) {
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/)
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}`
    }
  }
  return ''
}

export function extractWcagVersion(tags: string[]): '2.0' | '2.1' | '2.2' {
  if (tags.some(t => t.includes('wcag22'))) return '2.2'
  if (tags.some(t => t.includes('wcag21'))) return '2.1'
  return '2.0'
}

export function mapElementType(ruleId: string, html: string): string {
  const lower = `${ruleId} ${html}`.toLowerCase()
  if (lower.includes('image') || lower.includes('<img') || ruleId.includes('alt')) return 'image'
  if (lower.includes('form') || lower.includes('input') || lower.includes('label')) return 'form'
  if (lower.includes('link') || lower.includes('<a')) return 'link'
  if (lower.includes('heading') || lower.includes('<h')) return 'heading'
  if (lower.includes('table')) return 'table'
  if (lower.includes('video') || lower.includes('audio') || lower.includes('media')) return 'media'
  if (lower.includes('aria') || lower.includes('role')) return 'aria'
  return 'other'
}

export function mapResponsibleRole(ruleId: string, elementType: string): string {
  const editorRules = ['image-alt', 'link-name', 'heading-order', 'document-title', 'page-has-heading-one']
  const designerRules = ['color-contrast', 'focus-order', 'target-size']

  if (editorRules.some(r => ruleId.includes(r)) || ['image', 'link', 'heading'].includes(elementType)) {
    return 'editor'
  }
  if (designerRules.some(r => ruleId.includes(r))) return 'designer'
  return 'developer'
}

export function mapIssueType(impact: string, incomplete: boolean): 'error' | 'warning' | 'review' {
  if (incomplete) return 'review'
  if (impact === 'critical' || impact === 'serious') return 'error'
  return 'warning'
}

const IMPACT_WEIGHTS: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

export function calculateScore(issues: Array<{ impact: string }>): number {
  if (issues.length === 0) return 100
  const totalWeight = issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.impact] || 1), 0)
  const maxPossible = issues.length * 4
  return Math.max(0, Math.round((1 - totalWeight / maxPossible) * 100))
}

export { IMPACT_WEIGHTS, SC_PATTERN }
