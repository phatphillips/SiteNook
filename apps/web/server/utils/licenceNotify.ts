import type { H3Event } from 'h3'
import { getPbAdmin, resolveServerPbUrl } from './pbAdmin'

/** Ask PocketBase to email a newly issued Self-host licence key. */
export async function notifySelfHostLicenceEmail(
  event: H3Event | undefined,
  input: { email: string, licenceKey: string, expiresAt: string }
): Promise<{ sent: number, error?: string }> {
  const email = input.email.trim().toLowerCase()
  const licenceKey = input.licenceKey.trim()
  if (!email || !licenceKey) {
    return { sent: 0, error: 'email and licenceKey are required' }
  }

  try {
    const pb = await getPbAdmin(event)
    const token = pb.authStore.token
    if (!token) {
      return { sent: 0, error: 'PocketBase admin token missing' }
    }

    const pbUrl = resolveServerPbUrl(event)
    const response = await fetch(`${pbUrl}/api/sitenook/notify-selfhost-licence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        licenceKey,
        expiresAt: input.expiresAt
      })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[licenceNotify] PocketBase notify failed:', response.status, text)
      return { sent: 0, error: text || `HTTP ${response.status}` }
    }

    const payload = await response.json().catch(() => ({})) as { sent?: number }
    return { sent: Number(payload.sent ?? 0) }
  } catch (error) {
    console.warn('[licenceNotify]', error)
    return {
      sent: 0,
      error: error instanceof Error ? error.message : 'Could not send licence email'
    }
  }
}
