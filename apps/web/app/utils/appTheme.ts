/** Supported dashboard appearance modes (stored via @nuxtjs/color-mode). */
export type AppColorMode = 'light' | 'dark'

export const APP_COLOR_MODES: ReadonlyArray<{
  value: AppColorMode
  label: string
  icon: string
}> = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' }
]

export function isAppColorMode(value: string): value is AppColorMode {
  return value === 'light' || value === 'dark'
}

export function themeColorMeta(mode: string): string {
  if (mode === 'dark') return '#131418'
  return '#ffffff'
}
