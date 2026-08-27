import type { AccessibilityIssue } from '~/types/sitenook'
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
    'Frames without titles are announced generically, so users cannot tell what each embedded area contains.',
  'region':
    'Content outside landmarks is harder to find with screen reader shortcuts that jump between regions.',
  'list':
    'Incorrect list markup can cause screen readers to misread related items as unrelated paragraphs.',
  'listitem':
    'List items outside a list container are not announced as part of a list, which breaks expected navigation.',
  'aria-hidden-focus':
    'Focusable elements hidden from assistive technology create a confusing experience for keyboard and screen reader users.',
  'nested-interactive':
    'Interactive elements nested inside other interactive elements produce unpredictable focus and activation behaviour.'
}

/** Short actionable steps for high-frequency rules (not essays). */
const RULE_HOW_TO_FIX: Record<string, string[]> = {
  'heading-order': [
    'Use heading levels in order (h1 → h2 → h3) without skipping levels.',
    'Adjust the skipped heading to the next sequential level, or insert the missing level if structure requires it.',
    'Prefer real heading elements over styled paragraphs for section titles.'
  ],
  'image-alt': [
    'Add an alt attribute that describes the image’s purpose or content.',
    'Use alt="" only for purely decorative images that add no information.',
    'Avoid “image of” or filename text; describe what the user needs to know.'
  ],
  'link-name': [
    'Give the link visible text, or an accessible name via aria-label / aria-labelledby.',
    'Ensure icon-only links have a clear accessible name.',
    'Avoid vague text like “click here”; describe the destination or action.'
  ],
  'document-title': [
    'Add a unique, descriptive <title> in the document head.',
    'Include the page topic and, when useful, the site or product name.'
  ],
  'color-contrast': [
    'Increase contrast between text and background to meet WCAG (4.5:1 for normal text, 3:1 for large text).',
    'Check hover and focus states as well as default styles.',
    'Do not rely on colour alone to convey meaning.'
  ],
  'html-has-lang': [
    'Set lang on the <html> element to the primary language of the page (e.g. lang="en").'
  ],
  'page-has-heading-one': [
    'Add a single h1 that describes the main topic of the page.',
    'Keep only one h1; use lower levels for subsections.'
  ],
  'landmark-one-main': [
    'Wrap primary content in one <main> (or role="main") landmark.',
    'Remove extra main landmarks so assistive technology has a single primary region.'
  ],
  'button-name': [
    'Provide visible text on the button, or an accessible name via aria-label / aria-labelledby.',
    'Ensure icon-only buttons have a clear accessible name.'
  ],
  'label': [
    'Associate a <label> with each form control using for/id, or wrap the control in the label.',
    'If a visible label is not possible, use aria-label or aria-labelledby.'
  ],
  'duplicate-id': [
    'Ensure every id attribute is unique within the page.',
    'Update references (label for, aria-labelledby, etc.) to match the corrected ids.'
  ],
  'frame-title': [
    'Add a descriptive title attribute on each iframe or frame.',
    'Describe the purpose of the embedded content, not a generic “frame” label.'
  ]
}

const GENERIC_FALLBACK =
  'This issue creates barriers for people using assistive technology and may prevent them from using your content effectively.'

const PLACEHOLDER_FIX = 'See help URL for guidance.'

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
  if (fix && fix !== PLACEHOLDER_FIX) {
    const parts = fix
      .split('|')
      .map(p => p.trim())
      .filter(Boolean)
      .filter(p => !isRedundantWithTitle(p, issue.description, issue.rule_id))
    if (parts.length) return parts.join(' ')
  }

  return GENERIC_FALLBACK
}

/**
 * Split axe fix_suggestion (messages joined with ` | `) into clean steps.
 * Filters empty / placeholder / title-redundant parts.
 */
export function splitFixSuggestion(
  fixSuggestion: string | undefined | null,
  options?: { description?: string, ruleId?: string }
): string[] {
  const raw = fixSuggestion?.trim()
  if (!raw || raw === PLACEHOLDER_FIX) return []

  const description = options?.description ?? ''
  const ruleId = options?.ruleId ?? ''

  return raw
    .split('|')
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !(description && ruleId && isRedundantWithTitle(p, description, ruleId)))
}

/** Curated how-to-fix steps when available; otherwise parsed scanner suggestion. */
export function getIssueFixSteps(issue: AccessibilityIssue): string[] {
  const curated = RULE_HOW_TO_FIX[issue.rule_id]
  if (curated?.length) return curated

  return splitFixSuggestion(issue.fix_suggestion, {
    description: issue.description,
    ruleId: issue.rule_id
  })
}

/** WCAG Understanding doc URL; uses issue.wcag_version when present (fallback 2.2). */
export function getWcagUnderstandingUrl(issue: Pick<AccessibilityIssue, 'wcag_sc' | 'wcag_version'>): string {
  const sc = issue.wcag_sc?.trim()
  if (!sc) return ''

  const versionRaw = issue.wcag_version?.trim() || '2.2'
  const version = /^2\.[012]$/.test(versionRaw) ? versionRaw : '2.2'
  const pathSc = sc.replace(/\./g, '')
  return `https://www.w3.org/WAI/WCAG${version.replace('.', '')}/Understanding/${pathSc}`
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
