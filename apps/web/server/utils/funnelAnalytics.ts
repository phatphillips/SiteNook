/** Lightweight funnel analytics. Logs structured events; wire to a vendor later if needed. */

export type FunnelEventName
  = | 'trial_start'
    | 'first_site'
    | 'first_scan_complete'
    | 'aha_viewed'
    | 'upgrade_click'
    | 'trial_expired'
    | 'pricing_interval_toggle'
    | 'pricing_cta_click'
    | 'pricing_invoice_click'
    | 'pricing_closing_cta_click'

export function trackServerFunnelEvent(
  event: FunnelEventName,
  payload: Record<string, unknown> = {}
): void {
  console.info('[funnel]', JSON.stringify({ event, at: new Date().toISOString(), ...payload }))
}
