import { describe, expect, it } from 'vitest'
import {
  APP_COLOR_MODES,
  isAppColorMode,
  themeColorMeta
} from '~/utils/appTheme'

describe('appTheme', () => {
  it('lists light, dark, and solarized light modes', () => {
    expect(APP_COLOR_MODES.map(mode => mode.value)).toEqual([
      'light',
      'dark',
      'solarized-light'
    ])
  })

  it('recognizes supported color modes', () => {
    expect(isAppColorMode('solarized-light')).toBe(true)
    expect(isAppColorMode('system')).toBe(false)
  })

  it('maps theme-color meta for each appearance', () => {
    expect(themeColorMeta('dark')).toBe('#131418')
    expect(themeColorMeta('solarized-light')).toBe('#fdf6e3')
    expect(themeColorMeta('light')).toBe('#ffffff')
  })
})
