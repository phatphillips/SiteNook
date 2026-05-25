import readability from 'text-readability'

export function scoreReadability(text: string): number {
  if (!text || text.trim().length < 50) return 0
  try {
    const score = readability.fleschReadingEase(text)
    return Math.round(Math.max(0, Math.min(100, score)))
  } catch {
    return 0
  }
}
