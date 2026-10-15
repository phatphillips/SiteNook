import { describe, expect, it } from 'vitest'
import {
  APP_COLOR_MODES,
  isAppColorMode,
  themeColorMeta
} from '~/utils/appTheme'

describe('appTheme', () => {
  it('lists light and dark modes', () => {
    expect(APP_COLOR_MODES.map(mode => mode.value)).toEqual([
      'light',
      'dark'
    ])
  })

  it('recognizes supported color modes', () => {
    expect(isAppColorMode('light')).toBe(true)
    expect(isAppColorMode('dark')).toBe(true)
    expect(isAppColorMode('solarized-light')).toBe(false)
    expect(isAppColorMode('system')).toBe(false)
  })

  it('maps theme-color meta for each appearance', () => {
    expect(themeColorMeta('dark')).toBe('#131418')
    expect(themeColorMeta('light')).toBe('#ffffff')
  })
})
