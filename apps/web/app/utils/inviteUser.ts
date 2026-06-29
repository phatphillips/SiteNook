/** Generate a one-time password for invited users (set-password email follows). */
export function generateInvitePassword(): string {
  // ASCII-only — avoids PocketBase "Values don't match" issues with some generated symbols.
  const part = crypto.randomUUID().replace(/-/g, '')
  return `Inv${part}1!`
}
