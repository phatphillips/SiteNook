/** Supported dashboard appearance modes (stored via @nuxtjs/color-mode). */
export type AppColorMode = 'light' | 'dark' | 'solarized-light'

export const APP_COLOR_MODES: ReadonlyArray<{
  value: AppColorMode
  label: string
  icon: string
}> = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'solarized-light', label: 'Solarized light', icon: 'i-lucide-palette' }
]

export function isAppColorMode(value: string): value is AppColorMode {
  return value === 'light' || value === 'dark' || value === 'solarized-light'
}

export function themeColorMeta(mode: string): string {
  if (mode === 'dark') return '#131418'
  if (mode === 'solarized-light') return '#fdf6e3'
  return '#ffffff'
}
