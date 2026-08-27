/**
 * Decode crawl/upload filenames for display (e.g. Child%20Report.pdf → Child Report.pdf).
 */
export function displayPdfFilename(filename: string | null | undefined, fallback = 'document.pdf'): string {
  const raw = (filename ?? '').trim()
  if (!raw) return fallback
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    return raw
  }
}
