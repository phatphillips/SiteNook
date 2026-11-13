import { describe, expect, it } from 'vitest'

import {
  DONUT_CORNER_RADIUS,
  DONUT_GAP_DEG,
  DONUT_EDGE_MARGIN,
  DONUT_HALO_INNER_EXPAND,
  DONUT_HALO_OUTER_EXPAND,
  DONUT_INNER_RATIO,
  DONUT_OUTER_RADIUS,
  DONUT_SEMI_START_ANGLE,
  DONUT_SEMI_SWEEP,
  DONUT_START_ANGLE,
  DONUT_THICKNESS,
  DONUT_VIEWBOX,
  DONUT_VIEWBOX_PADDING,
  annularSectorPath,
  donutArcOptions,
  donutGeometryFitsViewBox,
  donutHaloGeometry,
  donutRingGeometry,
  isDonutChartStyle,
  layoutDonutSegments,
  roundedAnnularSectorPath,
  scoreDonutSegments,
  semiDonutRingGeometry
} from '~/utils/donutChart'

describe('donutChart', () => {
  it('derives outer radius from viewBox padding so the halo and margin fit', () => {
    expect(DONUT_VIEWBOX_PADDING).toBeCloseTo(
      DONUT_HALO_OUTER_EXPAND + DONUT_EDGE_MARGIN,
      5
    )
    expect(DONUT_OUTER_RADIUS).toBeCloseTo(
      DONUT_VIEWBOX / 2 - DONUT_VIEWBOX_PADDING,
      5
    )
    const geo = donutRingGeometry()
    expect(donutGeometryFitsViewBox(geo, { includeHalo: true })).toBe(true)
    const halo = donutHaloGeometry(geo)
    // Halo stays inside; edge margin leaves empty space outside it.
    expect(halo.outerRadius + geo.cx).toBeLessThanOrEqual(
      DONUT_VIEWBOX - DONUT_EDGE_MARGIN + 1e-6
    )
  })

  it('keeps ring thickness near 12% of outer diameter (inner ≈ 0.75 × outer)', () => {
    const geo = donutRingGeometry()
    expect(DONUT_INNER_RATIO).toBeCloseTo(0.75, 5)
    expect(geo.innerRadius / geo.outerRadius).toBeCloseTo(DONUT_INNER_RATIO, 5)
    const thicknessRatio = (geo.outerRadius - geo.innerRadius) / (geo.outerRadius * 2)
    expect(thicknessRatio).toBeGreaterThanOrEqual(0.11)
    expect(thicknessRatio).toBeLessThanOrEqual(0.13)
    expect(DONUT_THICKNESS).toBeCloseTo(geo.outerRadius - geo.innerRadius, 5)
    expect(DONUT_CORNER_RADIUS).toBeGreaterThan(0)
    expect(DONUT_CORNER_RADIUS).toBeLessThan(geo.outerRadius - geo.innerRadius)
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
    const outer = DONUT_OUTER_RADIUS
    const inner = outer * DONUT_INNER_RATIO
    const sharp = annularSectorPath(50, 50, inner, outer, 0, Math.PI / 2)
    const rounded = roundedAnnularSectorPath(
      50,
      50,
      inner,
      outer,
      0,
      Math.PI / 2,
      DONUT_CORNER_RADIUS
    )
    expect(rounded).not.toBe(sharp)
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
    const usable = DONUT_SEMI_SWEEP - gapRad * (laidOut.length - 1)
    const totalSweep = laidOut.reduce(
      (sum, segment) => sum + (segment.endAngle - segment.startAngle),
      0
    )
    expect(totalSweep).toBeCloseTo(usable, 5)
    const end = laidOut[laidOut.length - 1]!.endAngle
    expect(end).toBeCloseTo(DONUT_SEMI_START_ANGLE + DONUT_SEMI_SWEEP, 5)
    expect(laidOut.every(segment => segment.path.length > 0)).toBe(true)
  })

  it('keeps semi gauge ring metrics inside the square viewBox', () => {
    const semi = semiDonutRingGeometry()
    const full = donutRingGeometry()
    expect(semi.outerRadius).toBeCloseTo(full.outerRadius, 5)
    expect(semi.innerRadius / semi.outerRadius).toBeCloseTo(DONUT_INNER_RATIO, 5)
    expect(semi.cy).toBeGreaterThanOrEqual(full.cy)
    // Top of halo stays in viewBox; end caps sit on the diameter (y = cy).
    expect(semi.cy - semi.outerRadius - DONUT_HALO_OUTER_EXPAND).toBeGreaterThanOrEqual(-1e-6)
    expect(semi.cx - semi.outerRadius - DONUT_HALO_OUTER_EXPAND).toBeGreaterThanOrEqual(-1e-6)
    expect(semi.cx + semi.outerRadius + DONUT_HALO_OUTER_EXPAND).toBeLessThanOrEqual(
      DONUT_VIEWBOX + 1e-6
    )
  })

  it('builds a halo path with the same angles and a larger outer radius', () => {
    const geo = donutRingGeometry()
    const halo = donutHaloGeometry(geo)
    expect(halo.outerRadius).toBeCloseTo(geo.outerRadius + DONUT_HALO_OUTER_EXPAND, 5)
    expect(halo.innerRadius).toBeCloseTo(geo.innerRadius - DONUT_HALO_INNER_EXPAND, 5)

    const laidOut = layoutDonutSegments([
      { label: 'A', value: 40 },
      { label: 'B', value: 60 }
    ], { geometry: geo })
    expect(laidOut.every(segment => segment.haloPath.length > 0)).toBe(true)
    expect(laidOut[0]!.haloPath).not.toBe(laidOut[0]!.path)
    expect(laidOut[0]!.startAngle).toBeLessThan(laidOut[0]!.endAngle)
  })
})
