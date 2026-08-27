import { describe, expect, it } from 'vitest'
import {
  bboxFromPathD,
  constructPathToSvgD,
  operatorListToSvg,
  pathsToSvgObjects,
  translatePathD
} from '~/utils/pdfVectorSvg'
const OPS = {
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  curveTo2: 16,
  curveTo3: 17,
  closePath: 18,
  rectangle: 19,
  constructPath: 91,
  fill: 22,
  eoFill: 24,
  stroke: 21,
  save: 10,
  restore: 11,
  transform: 12,
  setFillRGBColor: 50,
  setStrokeRGBColor: 48,
  setGState: 9,
  setLineWidth: 2,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  clip: 29,
  eoClip: 30,
  endPath: 28,
  setFillGray: 46,
  setStrokeGray: 45,
  fillStroke: 25,
  eoFillStroke: 26,
  closeFillStroke: 27,
  closeEOFillStroke: 31,
  closeStroke: 23
} as Record<string, number>
describe('pdfVectorSvg objects', () => {
  it('converts rectangle constructPath ops to an SVG path d', () => {
    const d = constructPathToSvgD([OPS.rectangle], [10, 20, 30, 40], OPS)
    expect(d).toContain('M10 20')
    expect(d).toContain('Z')
  })
  it('computes bbox and translates path d', () => {
    expect(bboxFromPathD('M0 0L10 5Z')).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 5 })
    expect(translatePathD('M0 0L10 5Z', 2, 3)).toBe('M2 3L12 8Z')
  })
  it('keeps each fill as its own path in the page preview', () => {
    const { pathCount, paths } = operatorListToSvg(
      [
        OPS.setFillRGBColor,
        OPS.constructPath,
        OPS.fill,
        OPS.constructPath,
        OPS.fill
      ],
      [
        [64, 161, 84],
        [[OPS.rectangle], [0, 0, 100, 50], [0, 0, 100, 50]],
        [],
        [[OPS.rectangle], [10, 10, 20, 20], [10, 10, 30, 30]],
        []
      ],
      OPS,
      200,
      300
    )
    expect(pathCount).toBe(2)
    expect(paths).toHaveLength(2)
  })
  it('groups overlapping free paths into one SVG object', () => {
    const objects = pathsToSvgObjects(
      [
        {
          d: 'M0 0L20 0L20 20L0 20Z',
          fill: 'rgb(64,161,84)',
          stroke: 'none',
          fillOpacity: 1,
          strokeOpacity: 1,
          lineWidth: 1,
          evenOdd: false,
          wantsFill: true,
          wantsStroke: false,
          blendMode: 'Normal',
          bbox: { minX: 0, minY: 0, maxX: 20, maxY: 20 },
          formId: null,
          pageHeight: 100
        },
        {
          d: 'M15 15L40 15L40 40L15 40Z',
          fill: 'rgb(64,161,84)',
          stroke: 'none',
          fillOpacity: 1,
          strokeOpacity: 1,
          lineWidth: 1,
          evenOdd: false,
          wantsFill: true,
          wantsStroke: false,
          blendMode: 'Normal',
          bbox: { minX: 15, minY: 15, maxX: 40, maxY: 40 },
          formId: null,
          pageHeight: 100
        }
      ],
      1,
      { clusterPad: 5, minArea: 1 }
    )
    expect(objects).toHaveLength(1)
    expect(objects[0]!.kind).toBe('cluster')
    expect(objects[0]!.pathCount).toBe(2)
    expect(objects[0]!.svg).toContain('<path ')
  })
  it('keeps Form XObject paths as their own object', () => {
    const objects = pathsToSvgObjects(
      [
        {
          d: 'M0 0L10 0L10 10L0 10Z',
          fill: 'rgb(0,0,0)',
          stroke: 'none',
          fillOpacity: 1,
          strokeOpacity: 1,
          lineWidth: 1,
          evenOdd: false,
          wantsFill: true,
          wantsStroke: false,
          blendMode: 'Normal',
          bbox: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          formId: 1,
          pageHeight: 100
        },
        {
          d: 'M100 100L110 100L110 110L100 110Z',
          fill: 'rgb(255,0,0)',
          stroke: 'none',
          fillOpacity: 1,
          strokeOpacity: 1,
          lineWidth: 1,
          evenOdd: false,
          wantsFill: true,
          wantsStroke: false,
          blendMode: 'Normal',
          bbox: { minX: 100, minY: 100, maxX: 110, maxY: 110 },
          formId: null,
          pageHeight: 100
        }
      ],
      1,
      { clusterPad: 2, minArea: 1 }
    )
    expect(objects.some(o => o.kind === 'form')).toBe(true)
    expect(objects.some(o => o.kind === 'cluster')).toBe(true)
  })
})
