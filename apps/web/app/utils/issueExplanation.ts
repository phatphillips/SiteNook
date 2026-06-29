import type { AccessibilityIssue } from '~/types/accessiq'
import { normalizePageUrl } from '~/utils/pageUrl'

/** Plain-English “why it matters” copy — not the issue title or rule name. */
const RULE_WHY_IT_MATTERS: Record<string, string> = {
  'heading-order':
    'Skipping heading levels confuses screen readers and breaks document structure, making it harder to navigate the page.',
  'image-alt':
    'Images without alternative text are invisible to screen reader users who rely on text descriptions of visual content.',
  'link-name':
    'Links without accessible names are announced as unlabeled controls, so users cannot tell where they will go.',
  'document-title':
    'A missing or unclear page title makes it difficult for screen reader users to identify the page when switching tabs or windows.',
  'color-contrast':
    'Low contrast between text and background makes content hard to read for people with low vision or colour blindness.',
  'html-has-lang':
    'Without a language attribute, screen readers may use the wrong pronunciation rules for your content.',
  'page-has-heading-one':
    'A missing main heading makes it harder for screen reader users to understand the primary purpose of the page.',
  'landmark-one-main':
    'Multiple or missing main landmarks make it harder to jump directly to the primary content.',
  'button-name':
    'Buttons without accessible names cannot be understood or activated reliably by assistive technology users.',
  'label':
    'Form fields without labels are difficult or impossible to complete for screen reader and voice control users.',
  'duplicate-id':
    'Duplicate IDs break relationships between labels, descriptions, and controls in assistive technology.',
  'frame-title':
    'Frames without titles are announced generically, so users cannot tell what each embedded area contains.'
}

const GENERIC_FALLBACK =
  'This issue creates barriers for people using assistive technology and may prevent them from using your content effectively.'

function isRedundantWithTitle(text: string, title: string, ruleId: string): boolean {
  const normalized = text.trim().toLowerCase()
  const titleNorm = title.trim().toLowerCase()
  if (!normalized || normalized === titleNorm) return true
  if (normalized.includes(titleNorm) && normalized.length < titleNorm.length + 20) return true
  const ruleWords = ruleId.replace(/-/g, ' ')
  if (normalized === ruleWords) return true
  return false
}

export function getIssueWhyItMatters(issue: AccessibilityIssue): string {
  const fromRule = RULE_WHY_IT_MATTERS[issue.rule_id]
  if (fromRule) return fromRule

  const fix = issue.fix_suggestion?.trim()
  if (fix && fix !== 'See help URL for guidance.') {
    const parts = fix
      .split(' | ')
      .map(p => p.trim())
      .filter(p => !isRedundantWithTitle(p, issue.description, issue.rule_id))
    if (parts.length) return parts.join(' ')
  }

  return GENERIC_FALLBACK
}

export function formatIssueSeverity(impact: AccessibilityIssue['impact']): string {
  if (impact === 'critical' || impact === 'serious') return 'Critical'
  return impact.charAt(0).toUpperCase() + impact.slice(1)
}

export function truncatePageUrl(url: string, maxLength = 48): string {
  if (url.length <= maxLength) return url
  return `...${url.slice(-(maxLength - 3))}`
}

/** Returns { domain, path } parsed from a URL string. Falls back gracefully. */
export function parsePageUrl(url: string): { domain: string; path: string } {
  try {
    const u = new URL(normalizePageUrl(url))
    const path = u.pathname + u.search + u.hash
    const displayPath = path.length > 50 ? `…${path.slice(-(50 - 1))}` : path
    return { domain: u.hostname, path: displayPath || '/' }
  } catch {
    return { domain: url, path: '' }
  }
}
