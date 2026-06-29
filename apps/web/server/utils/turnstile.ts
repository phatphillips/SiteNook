export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteIp?: string
): Promise<boolean> {
  const trimmedSecret = secret.trim()
  const trimmedToken = token.trim()
  if (!trimmedSecret || !trimmedToken) return false

  const body = new URLSearchParams({
    secret: trimmedSecret,
    response: trimmedToken
  })
  if (remoteIp) {
    body.set('remoteip', remoteIp)
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) return false

  const data = await response.json() as { success?: boolean }
  return data.success === true
}
