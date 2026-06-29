import { MIN_QUERY_LENGTH } from '~/utils/globalSearch'

/** True when the query looks like a URL or hostname (common for in-PDF link searches). */
export function isUrlLikeQuery(query: string): boolean {
  const q = query.trim()
  if (!q) return false
  if (/^https?:\/\//i.test(q)) return true
  if (/^www\./i.test(q)) return true
  // hostname.tld with optional path
  return /^[a-z0-9][-a-z0-9.]*\.[a-z]{2,}(\/|$)/i.test(q)
}

/** Search needles for matching a URL query against indexed plain text. */
export function urlSearchVariants(query: string): string[] {
  const trimmed = query.trim()
  const variants = new Set<string>()
  if (trimmed.length >= MIN_QUERY_LENGTH) variants.add(trimmed)

  const add = (value: string | undefined) => {
    if (!value || value.length < MIN_QUERY_LENGTH) return
    variants.add(value)
  }

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProto)
    const host = parsed.hostname
    const bareHost = host.replace(/^www\./i, '')
    const wwwHost = bareHost.startsWith('www.') ? bareHost : `www.${bareHost}`
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`

    add(host)
    add(bareHost)
    add(wwwHost)
    add(`${wwwHost}${path}`)
    add(`${bareHost}${path}`)
    add(`${parsed.protocol}//${host}${path}`)
    add(`${parsed.protocol}//${wwwHost}${path}`)
  } catch {
    const noProto = trimmed.replace(/^https?:\/\//i, '')
    add(noProto)
    add(noProto.replace(/^www\./i, ''))
    if (!/^www\./i.test(noProto)) add(`www.${noProto}`)
  }

  return [...variants]
}

/**
 * Best Typesense query token for a URL-like string.
 * Strips protocol/www and drops a likely-truncated final TLD label (e.g. .gov.a → search .gov).
 */
export function typesenseTokenForUrlQuery(query: string): string {
  let host = query.trim()
  try {
    const withProto = /^https?:\/\//i.test(host) ? host : `https://${host}`
    host = new URL(withProto).hostname
  } catch {
    host = host.replace(/^https?:\/\//i, '').split(/[/?#]/)[0]!
  }

  host = host.replace(/^www\./i, '')
  const labels = host.split('.').filter(Boolean)
  // Only strip a single-character final label (e.g. user typed decyp.tas.gov.a).
  if (labels.length >= 2 && labels[labels.length - 1]!.length === 1) {
    return labels.slice(0, -1).join('.')
  }
  return host || query.trim()
}

export function urlQueryMatchesInText(query: string, text: string): boolean {
  if (!text) return false
  const textLower = text.toLowerCase()

  for (const variant of urlSearchVariants(query)) {
    if (textLower.includes(variant.toLowerCase())) return true
  }

  const core = typesenseTokenForUrlQuery(query)
  return core.length >= MIN_QUERY_LENGTH && textLower.includes(core.toLowerCase())
}

export function findUrlMatchIndex(query: string, text: string): number | null {
  if (!text) return null
  const textLower = text.toLowerCase()

  const needles = [
    ...urlSearchVariants(query),
    typesenseTokenForUrlQuery(query)
  ].sort((a, b) => b.length - a.length)

  for (const needle of needles) {
    if (needle.length < MIN_QUERY_LENGTH) continue
    const idx = textLower.indexOf(needle.toLowerCase())
    if (idx >= 0) return idx
  }
  return null
}
