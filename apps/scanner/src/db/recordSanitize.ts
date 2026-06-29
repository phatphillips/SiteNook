import { normalizeImpact } from '../accessibility/wcagMapper.js'

export function isHttpUrl(value: string): boolean {
  if (!value?.trim()) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** PocketBase url fields reject empty strings — omit invalid values instead. */
export function optionalHttpUrl(value: string | undefined | null): string | undefined {
  if (!value || !isHttpUrl(value)) return undefined
  return value
}

export function requireHttpUrl(value: string, fallback?: string): string {
  if (isHttpUrl(value)) return value
  if (fallback && isHttpUrl(fallback)) return fallback
  throw new Error(`Invalid URL for PocketBase: ${value}`)
}

export function sanitizeAxeIssue<T extends Record<string, unknown>>(issue: T): T {
  const helpUrl = optionalHttpUrl(String(issue.help_url ?? ''))
  const next: Record<string, unknown> = {
    ...issue,
    impact: normalizeImpact(issue.impact as string | undefined)
  }
  if (helpUrl) {
    next.help_url = helpUrl
  } else {
    delete next.help_url
  }
  return next as T
}

export function sanitizeInventoryRecord<T extends { url: string }>(record: T): T | null {
  if (!isHttpUrl(record.url)) return null
  return record
}
