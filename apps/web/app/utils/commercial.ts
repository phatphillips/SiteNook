/**
 * Client/shared commercial gate. Prefer runtimeConfig.public.commercialEnabled in the browser.
 * See docs/commercial.md
 */

export function parseCommercialFlag(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

/** True when billing/licence UI and Free caps apply. Default: false (OSS). */
export function isCommercialEnabled(value?: unknown): boolean {
  if (value !== undefined) return parseCommercialFlag(value)
  if (import.meta.server) {
    return parseCommercialFlag(process.env.SITENOOK_COMMERCIAL)
  }
  try {
    const config = useRuntimeConfig()
    return parseCommercialFlag(config.public.commercialEnabled)
  } catch {
    return parseCommercialFlag(process.env.SITENOOK_COMMERCIAL)
  }
}
