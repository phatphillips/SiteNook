export interface LlmsCheckResult {
  url: string
  found: boolean
  status?: number
  valid: boolean
  linkCount: number
  hasSummary: boolean
}

/** Fetch and validate llms.txt at site root. */
export async function checkLlmsTxt(origin: string): Promise<LlmsCheckResult> {
  const url = `${origin}/llms.txt`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SiteNook-Scanner/1.0' }
    })
    if (!res.ok) {
      return { url, found: false, status: res.status, valid: false, linkCount: 0, hasSummary: false }
    }
    const text = (await res.text()).trim()
    if (!text) {
      return { url, found: false, status: res.status, valid: false, linkCount: 0, hasSummary: false }
    }
    const linkCount = (text.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? []).length
      + (text.match(/^https?:\/\//gm) ?? []).length
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const proseLines = lines.filter(l => !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('*'))
    const hasSummary = proseLines.some(l => l.length >= 20) || lines.some(l => l.startsWith('#'))
    const valid = hasSummary && linkCount >= 1
    return { url, found: true, status: res.status, valid, linkCount, hasSummary }
  } catch {
    return { url, found: false, valid: false, linkCount: 0, hasSummary: false }
  }
}
