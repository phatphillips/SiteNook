import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRIMARY_COLOR,
  PRIMARY_COLOR_OPTIONS,
  PRIMARY_COLOR_VALUES,
  accessibleSiteBadgePalette,
  contrastRatio,
  cssColorToRgbTriplet,
  ensureContrastWithWhite,
  isPrimaryColor,
  parseRgbTriplet,
  primaryColorLabel
} from '~/utils/primaryColor'

describe('primaryColor', () => {
  it('includes the Nuxt UI primary palette', () => {
    expect(PRIMARY_COLOR_VALUES).toContain('blue')
    expect(PRIMARY_COLOR_VALUES).toContain('green')
    expect(PRIMARY_COLOR_VALUES).toContain('rose')
    expect(PRIMARY_COLOR_OPTIONS).toHaveLength(PRIMARY_COLOR_VALUES.length)
  })

  it('defaults to blue', () => {
    expect(DEFAULT_PRIMARY_COLOR).toBe('blue')
  })

  it('validates and labels colour names', () => {
    expect(isPrimaryColor('emerald')).toBe(true)
    expect(isPrimaryColor('solarized-light')).toBe(false)
    expect(primaryColorLabel('sky')).toBe('Sky')
  })

  it('parses hex colours into RGB triplets for chart gradients', () => {
    expect(cssColorToRgbTriplet('#ec4899')).toBe('236, 72, 153')
    expect(cssColorToRgbTriplet('rgb(43, 127, 255)')).toBe('43, 127, 255')
  })

  it('keeps primary colour names for immediate paint resolution', () => {
    expect(isPrimaryColor('emerald')).toBe(true)
    expect(PRIMARY_COLOR_OPTIONS.find(o => o.value === 'emerald')?.chip).toBe('emerald')
  })

  it('darkens light primaries so white badge text meets WCAG AA', () => {
    const yellow = parseRgbTriplet(cssColorToRgbTriplet('#eab308')!)!
    const accessible = ensureContrastWithWhite(yellow)
    expect(contrastRatio(accessible, [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps bright fuchsia as the badge fill with dark, AA text', () => {
    const fuchsia = parseRgbTriplet('217, 70, 239')!
    const palette = accessibleSiteBadgePalette(fuchsia)
    const fg = parseRgbTriplet(palette.fg.replace('rgb(', '').replace(')', ''))!
    const bgA = parseRgbTriplet(palette.a.replace('rgb(', '').replace(')', ''))!
    // Same paint as the chart primary (not over-darkened).
    expect(bgA).toEqual(fuchsia)
    expect(fg[0]).toBeLessThan(40)
    expect(contrastRatio(bgA, fg)).toBeGreaterThanOrEqual(4.5)
  })

  it('builds contrast-safe primary badges across the palette', () => {
    for (const triplet of ['43, 127, 255', '217, 70, 239', '234, 179, 8', '0, 193, 106']) {
      const primary = parseRgbTriplet(triplet)!
      const palette = accessibleSiteBadgePalette(primary)
      const fg = parseRgbTriplet(palette.fg.replace('rgb(', '').replace(')', ''))!
      for (const key of ['a', 'aa', 'aaa', 'aria', 'bp'] as const) {
        const bg = parseRgbTriplet(palette[key].replace('rgb(', '').replace(')', ''))!
        expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5)
        // All level badges share one primary fill for consistency.
        expect(palette[key]).toBe(palette.a)
      }
    }
  })
})
