/**
 * Commercial module gate for the scanner worker.
 * OSS default: off (unlimited). Set SITENOOK_COMMERCIAL=1 to restore paid paths.
 * See docs/commercial.md
 */

export function parseCommercialFlag(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

/** True when Stripe/Polar/licence enforcement should run. Default: false (OSS). */
export function isCommercialEnabled(value?: unknown): boolean {
  if (value !== undefined) return parseCommercialFlag(value)
  return parseCommercialFlag(process.env.SITENOOK_COMMERCIAL)
}
