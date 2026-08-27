import { describe, expect, it } from 'vitest'
import {
  formatScoreLabel,
  renderHorizontalBarChart,
  renderLineTrendSvg,
  renderScoreDonutSvg,
  scoreRingColor
} from '../../../src/reports/reportChartSvg.js'

describe('reportChartSvg', () => {
  it('maps score colors by threshold', () => {
    expect(scoreRingColor(80)).toBe('#22c55e')
    expect(scoreRingColor(60)).toBe('#f59e0b')
    expect(scoreRingColor(30)).toBe('#ef4444')
  })

  it('formats score labels', () => {
    expect(formatScoreLabel(82.4)).toBe('82.4')
    expect(formatScoreLabel(90)).toBe('90')
    expect(formatScoreLabel(null)).toBe('—')
  })

  it('renders a score donut svg', () => {
    const svg = renderScoreDonutSvg(82, 'Accessibility score')
    expect(svg).toContain('<svg')
    expect(svg).toContain('Accessibility score')
    expect(svg).toContain('82')
    expect(svg).toContain('donut-label')
  })

  it('renders horizontal bars', () => {
    const html = renderHorizontalBarChart([
      { label: 'Level A', value: 80 },
      { label: 'Level AA', value: 65 }
    ])
    expect(html).toContain('Level A')
    expect(html).toContain('chart-bars')
    expect(html).toContain('<rect')
  })

  it('renders a line trend when enough points exist', () => {
    const svg = renderLineTrendSvg([
      { label: 'Jan 1', value: 70 },
      { label: 'Jan 2', value: 75 },
      { label: 'Jan 3', value: 78 }
    ])
    expect(svg).toContain('<svg')
    expect(svg).toContain('Jan 1')
    expect(svg).toContain('Jan 3')
  })

  it('shows fallback when trend data is sparse', () => {
    const html = renderLineTrendSvg([{ label: 'Jan 1', value: 70 }])
    expect(html).toContain('Not enough scan history')
  })
})
