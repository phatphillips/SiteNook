export function parseSelfServiceSignupFlag(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

export function formatOrganizationUrl(subdomain: string, appDomain: string, appUrl: string): string {
  const slug = subdomain.trim().toLowerCase()
  const domain = appDomain.trim().toLowerCase()

  if (domain === 'localhost') {
    try {
      const base = new URL(appUrl)
      const port = base.port ? `:${base.port}` : ''
      return `${base.protocol}//${slug}.localhost${port}`
    } catch {
      return `http://${slug}.localhost:3000`
    }
  }

  const protocol = appUrl.startsWith('http://') ? 'http' : 'https'
  return `${protocol}://${slug}.${domain}`
}
