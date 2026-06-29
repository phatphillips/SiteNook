import type { H3Event } from 'h3'
import { getPbAdmin, resolveServerPbUrl } from './pbAdmin'

/** Ask PocketBase to email billing contacts when subscription is canceled (30-day retention; org stays open). */
export async function notifyOrgChurnEmails(
  event: H3Event | undefined,
  organizationId: string
): Promise<{ sent: number, error?: string }> {
  try {
    const pb = await getPbAdmin(event)
    const token = pb.authStore.token
    if (!token) {
      return { sent: 0, error: 'PocketBase admin token missing' }
    }

    const pbUrl = resolveServerPbUrl(event)
    const response = await fetch(`${pbUrl}/api/accessiq/notify-org-churn`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ organizationId })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[orgClosureNotify] PocketBase churn notify failed:', response.status, text)
      return { sent: 0, error: text || `HTTP ${response.status}` }
    }

    const payload = await response.json().catch(() => ({})) as { sent?: number }
    return { sent: Number(payload.sent ?? 0) }
  } catch (error) {
    console.warn('[orgClosureNotify]', error)
    return {
      sent: 0,
      error: error instanceof Error ? error.message : 'Could not send churn retention emails'
    }
  }
}

/** Ask PocketBase to email billing contacts when an admin closes the organization (immediate lockout). */
export async function notifyOrgClosureEmails(
  event: H3Event | undefined,
  organizationId: string
): Promise<{ sent: number, error?: string }> {
  try {
    const pb = await getPbAdmin(event)
    const token = pb.authStore.token
    if (!token) {
      return { sent: 0, error: 'PocketBase admin token missing' }
    }

    const pbUrl = resolveServerPbUrl(event)
    const response = await fetch(`${pbUrl}/api/accessiq/notify-org-closure`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ organizationId })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[orgClosureNotify] PocketBase notify failed:', response.status, text)
      return { sent: 0, error: text || `HTTP ${response.status}` }
    }

    const payload = await response.json().catch(() => ({})) as { sent?: number }
    return { sent: Number(payload.sent ?? 0) }
  } catch (error) {
    console.warn('[orgClosureNotify]', error)
    return {
      sent: 0,
      error: error instanceof Error ? error.message : 'Could not send closure emails'
    }
  }
}
