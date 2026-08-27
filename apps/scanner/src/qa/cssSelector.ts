/** Conservative CSS selector check for exclude policies (browser + Node). */
export function isValidCssSelector(selector: string): boolean {
  const trimmed = selector.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('<') || trimmed.startsWith('/')) return false
  if (/\\[bBdDsSwW]/.test(trimmed)) return false

  if (typeof document !== 'undefined') {
    try {
      document.createElement('div').querySelector(trimmed)
      return true
    } catch {
      return false
    }
  }

  const count = (ch: string) => [...trimmed].filter(c => c === ch).length
  if (count('[') !== count(']')) return false
  if (count('(') !== count(')')) return false
  return /^[A-Za-z*#.[:_\-]/.test(trimmed)
}

/** True when a pattern looks like a leftover regex (e.g. `<iframe\\b`). */
export function looksLikeRegexPattern(pattern: string): boolean {
  const trimmed = pattern.trim()
  if (!trimmed) return false
  return trimmed.startsWith('<') || /\\[bBdDsSwW]/.test(trimmed)
}
