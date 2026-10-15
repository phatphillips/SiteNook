/** Nuxt UI primary palette names (Tailwind color scales). */
export const PRIMARY_COLOR_VALUES = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
] as const

export type PrimaryColor = (typeof PRIMARY_COLOR_VALUES)[number]

export const DEFAULT_PRIMARY_COLOR: PrimaryColor = 'blue'

export const PRIMARY_COLOR_STORAGE_KEY = 'sitenook-primary-color'

export const PRIMARY_COLOR_OPTIONS: ReadonlyArray<{
  value: PrimaryColor
  label: string
  /** Tailwind / Nuxt UI chip token for UDropdownMenu. */
  chip: string
}> = PRIMARY_COLOR_VALUES.map(value => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
  chip: value
}))

export function isPrimaryColor(value: string): value is PrimaryColor {
  return (PRIMARY_COLOR_VALUES as readonly string[]).includes(value)
}

export function primaryColorLabel(value: string): string {
  if (!isPrimaryColor(value)) return 'Blue'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function isDarkThemeRoot(root: HTMLElement): boolean {
  return root.classList.contains('dark') || root.dataset.theme === 'dark'
}

/** Normalize Tailwind / CSS color tokens into something canvas + color-mix can use. */
export function normalizeCssColorToken(color: string): string {
  const trimmed = color.trim()
  if (!trimmed) return trimmed
  // Tailwind v4 sometimes stores bare OKLCH channels: "0.65 0.2 350"
  if (/^[\d.]+\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.%]+)?$/.test(trimmed)) {
    return `oklch(${trimmed})`
  }
  return trimmed
}

/**
 * Resolve the live painted primary the same way SVG/CSS do
 * (`ring-color="var(--ui-primary)"` on ScoreDonut).
 */
export function resolvePrimaryPaintColor(colorName?: string | null): string | null {
  if (typeof document === 'undefined' || !document.body) return null

  const probe = document.createElement('span')
  // Prefer named Tailwind scale so charts update before Nuxt UI rewrites --ui-primary.
  if (colorName && isPrimaryColor(colorName)) {
    probe.style.color = `var(--color-${colorName}-500, var(--ui-primary))`
  } else {
    probe.style.color = 'var(--ui-primary)'
  }
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()

  if (resolved && resolved !== 'rgba(0, 0, 0, 0)' && resolved !== 'transparent') {
    return resolved
  }

  const styles = getComputedStyle(document.documentElement)
  if (colorName && isPrimaryColor(colorName)) {
    const fromScale = styles.getPropertyValue(`--color-${colorName}-500`).trim()
    if (fromScale) return normalizeCssColorToken(fromScale)
  }
  const uiPrimary = styles.getPropertyValue('--ui-primary').trim()
  if (uiPrimary) return normalizeCssColorToken(uiPrimary)
  const chartLine = styles.getPropertyValue('--color-chart-line').trim()
  if (chartLine) return normalizeCssColorToken(chartLine)
  return null
}

/** Untinted theme bases for score-bar mixes (do not rewrite canvas / sidebar chrome). */
const THEME_BASE = {
  light: {
    canvas: '#e8e8ec',
    elevated: '#ffffff'
  },
  dark: {
    canvas: 'rgb(19, 20, 24)',
    elevated: 'rgb(30, 31, 37)'
  }
} as const

const WHITE_RGB = [255, 255, 255] as const
const NEAR_BLACK_RGB = [24, 24, 27] as const
/** WCAG AA normal text. Badge labels are 10px/bold so keep the stricter floor. */
const MIN_TEXT_CONTRAST = 4.5

export type RgbTuple = readonly [number, number, number]

export function parseRgbTriplet(triplet: string): RgbTuple | null {
  const parts = triplet.split(',').map(part => Number.parseFloat(part.trim()))
  if (parts.length < 3 || parts.some(n => Number.isNaN(n))) return null
  return [
    Math.round(parts[0] as number),
    Math.round(parts[1] as number),
    Math.round(parts[2] as number)
  ]
}

function srgbChannelToLinear(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(rgb: RgbTuple): number {
  return (
    0.2126 * srgbChannelToLinear(rgb[0])
    + 0.7152 * srgbChannelToLinear(rgb[1])
    + 0.0722 * srgbChannelToLinear(rgb[2])
  )
}

export function contrastRatio(a: RgbTuple, b: RgbTuple): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function mixRgb(from: RgbTuple, to: RgbTuple, amount: number): RgbTuple {
  const t = Math.max(0, Math.min(1, amount))
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t)
  ]
}

function rgbCss(rgb: RgbTuple): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

/** Darken a colour until white text meets the minimum contrast ratio. */
export function ensureContrastWithWhite(
  rgb: RgbTuple,
  minRatio = MIN_TEXT_CONTRAST
): RgbTuple {
  let current: RgbTuple = rgb
  for (let i = 0; i < 48; i++) {
    if (contrastRatio(current, WHITE_RGB) >= minRatio) return current
    current = mixRgb(current, [0, 0, 0], 0.12)
  }
  return current
}

/** Pick white or near-black text for the best contrast on a background. */
export function contrastingTextOn(
  background: RgbTuple,
  minRatio = MIN_TEXT_CONTRAST
): RgbTuple {
  const whiteRatio = contrastRatio(background, WHITE_RGB)
  const darkRatio = contrastRatio(background, NEAR_BLACK_RGB)
  if (whiteRatio >= minRatio || darkRatio >= minRatio) {
    return whiteRatio >= darkRatio ? WHITE_RGB : NEAR_BLACK_RGB
  }
  return whiteRatio >= darkRatio ? WHITE_RGB : NEAR_BLACK_RGB
}

/**
 * Primary badge colours with WCAG AA text contrast.
 * Uses the live primary fill (same as donut / score bars). Picks dark or
 * white label colour from contrast; darkens the fill only when white text
 * is the better option and the raw primary fails AA.
 */
export function accessibleSiteBadgePalette(primaryRgb: RgbTuple): {
  fg: string
  a: string
  aa: string
  aaa: string
  aria: string
  bp: string
} {
  const whiteOnPrimary = contrastRatio(primaryRgb, WHITE_RGB)
  const darkOnPrimary = contrastRatio(primaryRgb, NEAR_BLACK_RGB)
  const preferWhite = whiteOnPrimary >= MIN_TEXT_CONTRAST
    && whiteOnPrimary >= darkOnPrimary

  let bg: RgbTuple = primaryRgb
  let fg: RgbTuple = preferWhite ? WHITE_RGB : NEAR_BLACK_RGB

  if (preferWhite) {
    bg = ensureContrastWithWhite(primaryRgb)
    fg = WHITE_RGB
  } else if (darkOnPrimary < MIN_TEXT_CONTRAST && whiteOnPrimary < MIN_TEXT_CONTRAST) {
    // Extremely mid-luminance edge case: darken until white text passes.
    bg = ensureContrastWithWhite(primaryRgb)
    fg = WHITE_RGB
  }

  const fill = rgbCss(bg)
  return {
    fg: rgbCss(fg),
    a: fill,
    aa: fill,
    aaa: fill,
    aria: fill,
    bp: fill
  }
}

/** Apply chart + score bar CSS from the active primary (not page/sidebar chrome). */
export function syncChartPrimaryCssVars(colorName?: string | null) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const primary = resolvePrimaryPaintColor(colorName)
  if (!primary) return

  const isDark = isDarkThemeRoot(root)
  const base = isDark ? THEME_BASE.dark : THEME_BASE.light
  const rgb = cssColorToRgbTriplet(primary)
  // Prefer canvas-safe rgb() so Chart.js and CSS share the same primary paint.
  const paint = rgb ? `rgb(${rgb})` : primary
  const paintRgb = rgb ? parseRgbTriplet(rgb) : null

  root.style.setProperty('--color-chart-line', paint)
  root.style.setProperty('--score-chip-fill-hover', paint)
  root.style.setProperty('--color-action-solid', paint)
  root.style.setProperty('--focus-ring-color', paint)

  // Clear any previously applied primary washes on canvas / sidebar.
  root.style.removeProperty('--ui-bg')
  root.style.removeProperty('--sidebar-nav-active-bg')
  root.style.removeProperty('--sidebar-nav-hover-bg')

  const fillSoft = isDark
    ? `color-mix(in srgb, ${paint} 58%, ${base.canvas})`
    : `color-mix(in srgb, ${paint} 68%, white)`
  const trackTint = isDark
    ? `color-mix(in srgb, ${paint} 22%, ${base.elevated})`
    : `color-mix(in srgb, ${paint} 14%, ${base.elevated})`
  const donutTrack = isDark
    ? `color-mix(in srgb, ${paint} 20%, transparent)`
    : `color-mix(in srgb, ${paint} 12%, transparent)`

  root.style.setProperty('--score-chip-fill', fillSoft)
  root.style.setProperty('--score-chip-track', trackTint)
  root.style.setProperty('--score-bar-track', trackTint)
  root.style.setProperty('--score-donut-track', donutTrack)
  root.style.setProperty('--score-chip-text-on-fill', isDark ? '#fafafa' : '#18181b')
  root.style.setProperty(
    '--score-chip-text-on-hover',
    paintRgb ? rgbCss(contrastingTextOn(paintRgb)) : '#ffffff'
  )

  if (paintRgb) {
    const badges = accessibleSiteBadgePalette(paintRgb)
    root.style.setProperty('--site-badge-fg', badges.fg)
    root.style.setProperty('--site-badge-bg-a', badges.a)
    root.style.setProperty('--site-badge-bg-aa', badges.aa)
    root.style.setProperty('--site-badge-bg-aaa', badges.aaa)
    root.style.setProperty('--site-badge-bg-aria', badges.aria)
    root.style.setProperty('--site-badge-bg-bp', badges.bp)
  }

  if (rgb) {
    root.style.setProperty('--color-chart-line-rgb', rgb)
  } else {
    root.style.removeProperty('--color-chart-line-rgb')
  }
}

/** Canvas-safe RGB triplet for the active primary (gradients, area fills). */
export function primaryColorRgbTriplet(colorName?: string | null): string | null {
  if (typeof document === 'undefined') return null
  if (!colorName) {
    const cached = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-chart-line-rgb')
      .trim()
    if (cached) return cached
  }
  const primary = resolvePrimaryPaintColor(colorName)
  if (!primary) return null
  return cssColorToRgbTriplet(primary)
}

export function cssColorToRgbTriplet(color: string): string | null {
  const normalized = normalizeCssColorToken(color)
  if (normalized.startsWith('#') && (normalized.length === 7 || normalized.length === 4)) {
    color = normalized
  } else {
    color = normalized
  }
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    if ([r, g, b].some(n => Number.isNaN(n))) return null
    return `${r}, ${g}, ${b}`
  }

  const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgbMatch) {
    return `${Math.round(Number(rgbMatch[1]))}, ${Math.round(Number(rgbMatch[2]))}, ${Math.round(Number(rgbMatch[3]))}`
  }

  if (typeof document === 'undefined' || !document.body) return null
  const el = document.createElement('span')
  el.style.color = color
  document.body.appendChild(el)
  const resolved = getComputedStyle(el).color
  el.remove()
  const resolvedMatch = resolved.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (!resolvedMatch) return null
  return `${Math.round(Number(resolvedMatch[1]))}, ${Math.round(Number(resolvedMatch[2]))}, ${Math.round(Number(resolvedMatch[3]))}`
}
