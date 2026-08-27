import { describe, expect, it } from 'vitest'
import {
  guessInventoryMimeType,
  inventoryUrlDedupeKey,
  isInventoryImageUrl,
  isInventoryPdfUrl,
  normalizeInventoryUrl
} from '~/utils/inventoryUrl'

describe('normalizeInventoryUrl', () => {
  it('strips query strings and hashes', () => {
    expect(normalizeInventoryUrl('https://example.com/page?a=1&b=2#section'))
      .toBe('https://example.com/page')
  })

  it('normalizes trailing slashes', () => {
    expect(normalizeInventoryUrl('https://example.com/dir/')).toBe('https://example.com/dir')
  })
})

describe('inventoryUrlDedupeKey', () => {
  it('treats query variants as the same URL', () => {
    expect(inventoryUrlDedupeKey('https://example.com/a?x=1'))
      .toBe(inventoryUrlDedupeKey('https://example.com/a?y=2'))
  })
})

describe('isInventoryImageUrl', () => {
  it('detects images by extension after query strip', () => {
    expect(isInventoryImageUrl('https://cdn.example.com/logo.png?w=200')).toBe(true)
    expect(isInventoryImageUrl('https://cdn.example.com/doc.pdf')).toBe(false)
  })
})

describe('isInventoryPdfUrl', () => {
  it('detects PDFs by path', () => {
    expect(isInventoryPdfUrl('https://example.com/file.pdf?download=1')).toBe(true)
  })
})

describe('guessInventoryMimeType', () => {
  it('guesses common image types', () => {
    expect(guessInventoryMimeType('https://example.com/a.jpg')).toBe('image/jpeg')
    expect(guessInventoryMimeType('https://example.com/a.webp')).toBe('image/webp')
  })
})
