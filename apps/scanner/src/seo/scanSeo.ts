import { parseSeoSnapshot } from './parseSeoSnapshot.js'
import { evaluateSeoRules } from './evaluateSeoRules.js'
import { extractInternalLinkTargets } from './linkGraph.js'
import type { SeoIssueDraft, SeoSettings, SeoSnapshot } from './types.js'

export interface RunPageSeoChecksInput {
  url: string
  title: string
  wordCount: number
  readabilityScore: number
  crawlDepth: number
  htmlSnapshot: string
  startUrl: string
  axeRuleIds?: string[]
  settings: SeoSettings
}

export interface RunPageSeoChecksResult {
  snapshot: SeoSnapshot
  issues: SeoIssueDraft[]
  internalLinks: string[]
}

export function shouldRunAccessibility(scanType: string): boolean {
  return scanType !== 'qa_only' && scanType !== 'seo_only'
}

export function shouldRunQa(scanType: string): boolean {
  return scanType !== 'accessibility_only' && scanType !== 'seo_only'
}

export function shouldRunSeo(scanType: string, settings?: SeoSettings): boolean {
  if (scanType === 'accessibility_only' || scanType === 'qa_only') return false
  if (settings && !settings.checkSeo) return false
  return true
}

export function runPageSeoChecks(input: RunPageSeoChecksInput): RunPageSeoChecksResult {
  const origin = new URL(input.startUrl).origin
  const snapshot = parseSeoSnapshot(input.htmlSnapshot, input.url)
  const isHomepage = normalizePath(input.url) === normalizePath(input.startUrl)

  const issues = evaluateSeoRules({
    url: input.url,
    title: input.title,
    wordCount: input.wordCount,
    readabilityScore: input.readabilityScore,
    snapshot,
    htmlSnapshot: input.htmlSnapshot,
    origin,
    isHttps: input.startUrl.startsWith('https://'),
    axeRuleIds: new Set(input.axeRuleIds ?? []),
    isHomepage,
    crawlDepth: input.crawlDepth
  }, input.settings)

  const internalLinks = extractInternalLinkTargets(input.htmlSnapshot, input.url, origin)

  return { snapshot, issues, internalLinks }
}

function normalizePath(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    let path = u.pathname
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1)
    return `${u.origin}${path}`
  } catch {
    return url
  }
}
