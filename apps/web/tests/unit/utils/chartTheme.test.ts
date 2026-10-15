import { describe, expect, it, vi } from 'vitest'

import {
  CHART_LINE_COLOR,
  buildChartTooltipOptions,
  chartAreaFill,
  chartAxisTickColor,
  chartLineColor,
  chartPointBorderColor,
  chartTooltipPalette,
  resolveChartThemeVariant
} from '~/utils/chartTheme'

describe('chartTheme', () => {
  it('uses the reference chart accent color', () => {
    expect(CHART_LINE_COLOR).toBe('#2b7fff')
  })

  it('resolves chart theme variants from color mode', () => {
    expect(resolveChartThemeVariant('dark')).toBe('dark')
    expect(resolveChartThemeVariant('solarized-light')).toBe('light')
    expect(resolveChartThemeVariant('light')).toBe('light')
  })

  it('uses the primary chart color for light charts', () => {
    expect(chartLineColor('light')).toBe(CHART_LINE_COLOR)
  })

  it('builds light tooltip palette', () => {
    const palette = chartTooltipPalette('light')
    expect(palette.backgroundColor).toBe('#ffffff')
    expect(palette.borderColor).toBe('#e5e7eb')
  })

  it('builds dark tooltip palette', () => {
    const palette = chartTooltipPalette('dark')
    expect(palette.backgroundColor).toBe('#1a1a1a')
    expect(palette.borderColor).toBe('#2d2d2d')
  })

  it('builds chart axis and point colors per variant', () => {
    expect(chartAxisTickColor('light')).toContain('0,0,0')
    expect(chartPointBorderColor('dark')).toBe('#1a1a1a')
  })

  it('builds chart tooltip options with series label', () => {
    const tooltip = buildChartTooltipOptions({
      variant: 'light',
      seriesLabel: 'Users',
      formatValue: v => `${v}`
    })

    expect(tooltip.borderWidth).toBe(1)
    expect(tooltip.displayColors).toBe(true)
    expect(tooltip.callbacks.label({ parsed: { y: 12 }, dataset: { label: 'Users' } })).toContain('Users')
  })

  it('creates a vertical area gradient', () => {
    const ctx = {
      createLinearGradient: () => ({
        addColorStop: vi.fn()
      })
    } as unknown as CanvasRenderingContext2D

    const gradient = chartAreaFill(ctx, { top: 0, bottom: 80 })
    expect(gradient).toBeTruthy()
  })
})
