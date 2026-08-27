import type { FunnelEventName } from '../../server/utils/funnelAnalytics'

export type { FunnelEventName }

export function trackFunnelEvent(
  event: FunnelEventName,
  payload: Record<string, unknown> = {}
): void {
  if (!import.meta.client) return
  console.info('[funnel]', JSON.stringify({ event, at: new Date().toISOString(), ...payload }))
  try {
    window.dispatchEvent(new CustomEvent('sitenook:funnel', { detail: { event, ...payload } }))
  } catch {
    // ignore
  }
}
