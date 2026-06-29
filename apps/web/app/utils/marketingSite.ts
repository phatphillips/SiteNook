/** Apex paths served by the marketing site (Phase G). */
export const MARKETING_APEX_PATHS = new Set(['/', '/pricing'])

export function parseMarketingSiteFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function isMarketingApexPath(path: string): boolean {
  return MARKETING_APEX_PATHS.has(path)
}
