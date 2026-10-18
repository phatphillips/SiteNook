import { describe, expect, it } from 'vitest'

import {
  DONUT_CORNER_RADIUS,
  DONUT_GAP_DEG,
  DONUT_SEMI_START_ANGLE,
  DONUT_SEMI_SWEEP,
  DONUT_START_ANGLE,
  DONUT_THICKNESS,
  annularSectorPath,
  donutArcOptions,
  donutRingGeometry,
  isDonutChartStyle,
  layoutDonutSegments,
  roundedAnnularSectorPath,
  scoreDonutSegments,
  semiDonutRingGeometry
} from '~/utils/donutChart'

describe('donutChart', () => {
  it('keeps cutout near 70–75% of outer radius and thickness near 1/8 diameter', () => {
    const geo = donutRingGeometry()
    expect(DONUT_THICKNESS).toBe(12.5)
    expect(geo.innerRadius / geo.outerRadius).toBeGreaterThanOrEqual(0.7)
    expect(geo.innerRadius / geo.outerRadius).toBeLessThanOrEqual(0.76)
    expect(DONUT_CORNER_RADIUS).toBeGreaterThanOrEqual(2.5)
    expect(DONUT_GAP_DEG).toBeGreaterThanOrEqual(3.5)
  })

  it('builds a closed annular sector path', () => {
    const path = annularSectorPath(50, 50, 30, 45, 0, Math.PI / 2)
    expect(path.startsWith('M ')).toBe(true)
    expect(path).toContain('A 45 45')
    expect(path).toContain('A 30 30')
    expect(path.endsWith('Z')).toBe(true)
  })

  it('splits a full ring into two semicircle arcs', () => {
    const path = annularSectorPath(50, 50, 30, 45, 0, Math.PI * 2)
    expect(path.match(/A 45 45/g)?.length).toBe(2)
    expect(path.match(/A 30 30/g)?.length).toBe(2)
  })

  it('builds rounded corners as small fillet arcs, not sharp radials only', () => {
    const sharp = annularSectorPath(50, 50, 35.5, 48, 0, Math.PI / 2)
    const rounded = roundedAnnularSectorPath(50, 50, 35.5, 48, 0, Math.PI / 2, DONUT_CORNER_RADIUS)
    expect(rounded).not.toBe(sharp)
    // Four corner fillets use the corner radius as the arc radius.
    const fillet = new RegExp(`A ${DONUT_CORNER_RADIUS} ${DONUT_CORNER_RADIUS}`, 'g')
    expect(rounded.match(fillet)?.length).toBe(4)
    expect(rounded.endsWith('Z')).toBe(true)
  })

  it('sorts categorical segments largest-first from 11 o\'clock', () => {
    const laidOut = layoutDonutSegments([
      { label: 'Small', value: 10 },
      { label: 'Large', value: 50 },
      { label: 'Mid', value: 20 }
    ])
    expect(laidOut.map(s => s.label)).toEqual(['Large', 'Mid', 'Small'])
    expect(laidOut[0]!.startAngle).toBeCloseTo(DONUT_START_ANGLE, 5)
    expect(laidOut[0]!.color).toBe('var(--donut-segment-1)')
    expect(laidOut.every(s => s.path.length > 0)).toBe(true)
    expect(laidOut.every(s => s.path.includes(`A ${DONUT_CORNER_RADIUS} ${DONUT_CORNER_RADIUS}`))).toBe(true)
  })

  it('keeps score first with primary token and remainder muted', () => {
    const segments = scoreDonutSegments(72)
    expect(segments).toEqual([
      { label: 'Score', value: 72, color: 'var(--donut-segment-1)' },
      { label: 'Remaining', value: 28, color: 'var(--score-donut-track)' }
    ])
    const laidOut = layoutDonutSegments(segments, { sortDescending: false })
    expect(laidOut[0]!.label).toBe('Score')
    expect(laidOut[0]!.color).toBe('var(--donut-segment-1)')
    // Gaps between score and remainder leave a clear break.
    const gap = (laidOut[1]!.startAngle - laidOut[0]!.endAngle + Math.PI * 2) % (Math.PI * 2)
    expect(gap).toBeCloseTo((DONUT_GAP_DEG * Math.PI) / 180, 5)
  })

  it('recognises full and semi chart styles', () => {
    expect(isDonutChartStyle('full')).toBe(true)
    expect(isDonutChartStyle('semi')).toBe(true)
    expect(isDonutChartStyle('gauge')).toBe(false)
    expect(donutArcOptions('semi')).toEqual({
      startAngle: DONUT_SEMI_START_ANGLE,
      arcSweep: DONUT_SEMI_SWEEP
    })
  })

  it('layouts a semi gauge over 180° with level end caps', () => {
    const segments = scoreDonutSegments(75)
    const laidOut = layoutDonutSegments(segments, {
      sortDescending: false,
      chartStyle: 'semi',
      geometry: semiDonutRingGeometry()
    })
    expect(laidOut.length).toBe(2)
    expect(laidOut[0]!.startAngle).toBeCloseTo(DONUT_SEMI_START_ANGLE, 5)
    const gapRad = (DONUT_GAP_DEG * Math.PI) / 180
    // Open arcs reserve gaps between segments only (n - 1).
    const usable = DONUT_SEMI_SWEEP - gapRad * (laidOut.length - 1)
    const totalSweep = laidOut.reduce(
      (sum, segment) => sum + (segment.endAngle - segment.startAngle),
      0
    )
    expect(totalSweep).toBeCloseTo(usable, 5)
    const end = laidOut[laidOut.length - 1]!.endAngle
    // Last tip lands on the same horizontal as the start (π → 2π).
    expect(end).toBeCloseTo(DONUT_SEMI_START_ANGLE + DONUT_SEMI_SWEEP, 5)
    expect(laidOut.every(segment => segment.path.length > 0)).toBe(true)
  })

  it('uses a larger lower-diameter ring for semi gauges', () => {
    const semi = semiDonutRingGeometry()
    const full = donutRingGeometry()
    expect(semi.outerRadius).toBeGreaterThan(full.outerRadius)
    expect(semi.cy).toBeGreaterThan(full.cy)
  })
})
