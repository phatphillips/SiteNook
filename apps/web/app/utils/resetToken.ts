/** Read the email address embedded in a PocketBase password-reset JWT (client-safe payload decode). */
export function decodePasswordResetTokenEmail(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed) return null

  try {
    const payloadSegment = trimmed.split('.')[1]
    if (!payloadSegment) return null

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const json = JSON.parse(atob(normalized + padding)) as { email?: unknown }
    return typeof json.email === 'string' && json.email.trim() ? json.email.trim() : null
  } catch {
    return null
  }
}
