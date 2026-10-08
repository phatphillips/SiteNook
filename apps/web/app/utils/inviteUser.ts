const INVITE_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Readable one-time password an admin can copy and share. ASCII-only for PocketBase. */
export function generateInvitePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let body = ''
  for (const byte of bytes) {
    body += INVITE_PASSWORD_ALPHABET[byte % INVITE_PASSWORD_ALPHABET.length]
  }
  return `Snk-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`
}
