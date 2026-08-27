import { describe, expect, it } from 'vitest'
import {
  orderTabCandidates,
  scaleTabOrderMarkers,
  type SimulatorTabOrderPayload
} from '~/utils/simulatorTabOrder'

describe('simulatorTabOrder', () => {
  it('orders positive tabindex before document order', () => {
    const ordered = orderTabCandidates([
      { id: 'a', tabindex: 0 },
      { id: 'b', tabindex: 2 },
      { id: 'c', tabindex: 1 },
      { id: 'd', tabindex: 0 }
    ])
    expect(ordered.map(n => n.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('scales markers from page coordinates onto display size', () => {
    const payload: SimulatorTabOrderPayload = {
      pageWidth: 1000,
      pageHeight: 2000,
      entries: [
        {
          index: 1,
          tag: 'a',
          role: 'link',
          name: 'Home',
          x: 100,
          y: 200,
          width: 40,
          height: 20
        }
      ]
    }

    const markers = scaleTabOrderMarkers(payload, 500, 1000)
    expect(markers).toHaveLength(1)
    expect(markers[0].left).toBe(50)
    expect(markers[0].top).toBe(100)
    expect(markers[0].label).toBe('Home')
  })

  it('returns empty markers when payload or display size is missing', () => {
    expect(scaleTabOrderMarkers(null, 100, 100)).toEqual([])
    expect(scaleTabOrderMarkers({
      pageWidth: 100,
      pageHeight: 100,
      entries: [{
        index: 1,
        tag: 'button',
        role: 'button',
        name: 'Go',
        x: 10,
        y: 10,
        width: 5,
        height: 5
      }]
    }, 0, 100)).toEqual([])
  })
})
