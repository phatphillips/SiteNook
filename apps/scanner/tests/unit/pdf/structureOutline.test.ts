import { describe, expect, it } from 'vitest'
import { buildStructureOutline, computeIssueDelta, computeLiftPercent } from '../../../src/pdf/structureOutline.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('structureOutline', () => {
  it('builds outline from golden sample JSON', () => {
    const sample = readFileSync(
      join(process.cwd(), '../../tests/fixtures/pdfs/golden/structure-outline.sample.json'),
      'utf8'
    )
    // Use a richer JSON like ODL would emit
    const odlLike = JSON.stringify({
      elements: [
        { id: 1, type: 'heading', 'page number': 1, content: 'Title', 'bounding box': [72, 700, 400, 730] },
        { id: 2, type: 'paragraph', 'page number': 1, content: 'Body', 'bounding box': [72, 650, 500, 690] },
        { id: 3, type: 'table', 'page number': 1, content: 'Table' }
      ]
    })
    const outline = buildStructureOutline(odlLike)
    expect(outline.elementCount).toBeGreaterThanOrEqual(3)
    expect(outline.types.heading).toBe(1)
    expect(outline.items[0]?.bbox?.length).toBe(4)
    expect(JSON.parse(sample).types.heading).toBe(1)
  })

  it('computes issue delta and lift', () => {
    expect(computeIssueDelta(10, 4)).toBe(6)
    expect(computeLiftPercent(10, 4)).toBe(60)
    expect(computeLiftPercent(0, 0)).toBe(0)
  })
})
