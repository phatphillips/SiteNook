import { describe, expect, it } from 'vitest'
import {
  extractCssUrls,
  orderTabCandidates
} from '../../../src/crawler/captureSimulatorPreview.js'

describe('captureSimulatorPreview helpers', () => {
  it('orders positive tabindex before document-order zero tabindex', () => {
    const ordered = orderTabCandidates([
      { label: 'Home', tabindex: 0 },
      { label: 'Second', tabindex: 2 },
      { label: 'First', tabindex: 1 },
      { label: 'Save', tabindex: 0 }
    ])
    expect(ordered.map(n => n.label)).toEqual(['First', 'Second', 'Home', 'Save'])
  })

  it('extracts css background urls and skips data uris', () => {
    expect(extractCssUrls(
      'background-image: url("https://cdn.example/a.png"), url(../b.jpg); content: url(data:image/png;base64,xx);'
    )).toEqual([
      'https://cdn.example/a.png',
      '../b.jpg'
    ])
  })
})
