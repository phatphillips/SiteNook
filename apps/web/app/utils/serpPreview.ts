export type SerpDevice = 'mobile' | 'desktop'

export interface SerpPagePickerItem {
  label: string
  description?: string
  value: string
}

export interface SerpPreviewLimits {
  titleMax: number
  descriptionMax: number
}

const DEFAULT_LIMITS: Record<SerpDevice, SerpPreviewLimits> = {
  mobile: { titleMax: 60, descriptionMax: 157 },
  desktop: { titleMax: 70, descriptionMax: 160 }
}

export function serpLimitsForDevice(device: SerpDevice): SerpPreviewLimits {
  return DEFAULT_LIMITS[device]
}

/** Truncate at word boundary with ellipsis for SERP preview display. */
export function truncateSerpText(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length <= maxLength) return trimmed
  const slice = trimmed.slice(0, maxLength)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

export function serpTitlePreview(title: string, device: SerpDevice): string {
  return truncateSerpText(title, serpLimitsForDevice(device).titleMax)
}

export function serpDescriptionPreview(
  description: string,
  device: SerpDevice,
  options?: { includeDate?: boolean, dateLabel?: string }
): string {
  const limits = serpLimitsForDevice(device)
  let text = description.trim()
  if (options?.includeDate && options.dateLabel) {
    text = `${options.dateLabel}. ${text}`
  }
  return truncateSerpText(text, limits.descriptionMax)
}

export function isOverSerpLimit(text: string, maxLength: number): boolean {
  return text.trim().length > maxLength
}

export function formatSerpDate(value: string | undefined | null): string | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(ms))
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Website'
  }
}

export function breadcrumbFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/$/, '') || '/'
    if (path === '/') return parsed.hostname
    return `${parsed.hostname}${path}`
  } catch {
    return url
  }
}
