import { describe, expect, it } from 'vitest'
import {
  collectImageObjectIds,
  extractImageRefFromArg,
  getPdfObj,
  hasBinaryPayload,
  IMAGE_KIND,
  imageContentFingerprint,
  isJpegBytes,
  rgbaFromPdfImage,
  storeForImageName
} from '~/utils/pdfImageExtract'

describe('pdfImageExtract helpers', () => {
  it('routes g_ image names to commonObjs', () => {
    const page = {
      objs: { get: () => undefined },
      commonObjs: { get: () => undefined }
    }
    const doc = { commonObjs: { get: () => undefined } }
    expect(storeForImageName('g_d0_img_1', page as never, doc as never)).toBe(page.commonObjs)
    expect(storeForImageName('img_p1_1', page as never, doc as never)).toBe(page.objs)
  })

  it('times out when objs.get callback never fires', async () => {
    const hangStore = {
      get: (_id: string, callback?: (data: unknown) => void) => {
        if (!callback) {
          throw new Error('Requesting object that isn\'t resolved yet')
        }
      }
    }

    const result = await getPdfObj(hangStore as never, 'img_missing', 50)
    expect(result).toBeNull()
  })

  it('returns sync object when already resolved', async () => {
    const img = { width: 2, height: 1, kind: IMAGE_KIND.RGB_24BPP, data: new Uint8Array([1, 2, 3, 4, 5, 6]) }
    const store = {
      get: (_id: string, callback?: (data: unknown) => void) => {
        if (callback) callback(img)
        return img
      }
    }
    const result = await getPdfObj(store as never, 'img_1', 500)
    expect(result).toEqual(img)
  })

  it('converts RGB image bytes to RGBA', () => {
    const rgba = rgbaFromPdfImage({
      width: 2,
      height: 1,
      kind: IMAGE_KIND.RGB_24BPP,
      data: new Uint8Array([10, 20, 30, 40, 50, 60])
    })
    expect(rgba).not.toBeNull()
    expect(Array.from(rgba!.subarray(0, 8))).toEqual([10, 20, 30, 255, 40, 50, 60, 255])
  })

  it('converts packed 1bpp image masks used for logos', () => {
    // 8x1 mask: one byte, high bit set
    const rgba = rgbaFromPdfImage({
      width: 8,
      height: 1,
      kind: IMAGE_KIND.GRAYSCALE_1BPP,
      data: new Uint8Array([0b10000000])
    })
    expect(rgba).not.toBeNull()
    expect(rgba![0]).toBe(0)
    expect(rgba![3]).toBe(255)
    expect(rgba![4]).toBe(255)
    expect(rgba![7]).toBe(0)
  })

  it('detects JPEG SOI marker', () => {
    expect(isJpegBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(isJpegBytes(new Uint8Array([0x00, 0x01]))).toBe(false)
  })

  it('rejects incomplete image data', () => {
    expect(rgbaFromPdfImage({ width: 10, height: 10, data: new Uint8Array([1, 2, 3]) })).toBeNull()
  })

  it('reads image refs from mask args where data is an object id string', () => {
    expect(extractImageRefFromArg('img_p0_3')).toBe('img_p0_3')
    expect(extractImageRefFromArg({ data: 'img_p0_4', width: 40, height: 12 })).toBe('img_p0_4')
    expect(extractImageRefFromArg({ data: new Uint8Array([1, 2]), width: 1, height: 1 })).toBeNull()
    expect(hasBinaryPayload({ data: 'img_p0_4', width: 40, height: 12 })).toBe(false)
    expect(hasBinaryPayload({ data: new Uint8Array([1, 2]), width: 1, height: 1 })).toBe(true)
  })

  it('collects mask + dependency image ids from operator lists', () => {
    const OPS = {
      dependency: 1,
      paintImageXObject: 85,
      paintImageMaskXObject: 83,
      paintInlineImageXObject: 86
    }
    const ids = collectImageObjectIds(
      [OPS.dependency, OPS.paintImageMaskXObject, OPS.paintImageXObject],
      [
        ['g_font_1', 'img_p0_mask'],
        [{ data: 'img_p0_mask', width: 64, height: 16, count: 1 }],
        ['img_p0_body']
      ],
      OPS
    )
    expect(ids).toContain('img_p0_mask')
    expect(ids).toContain('img_p0_body')
    expect(ids).not.toContain('g_font_1')
  })

  it('fingerprints identical pixel buffers the same way', () => {
    const a = {
      width: 2,
      height: 1,
      kind: IMAGE_KIND.RGB_24BPP,
      data: new Uint8Array([1, 2, 3, 4, 5, 6])
    }
    const b = {
      width: 2,
      height: 1,
      kind: IMAGE_KIND.RGB_24BPP,
      data: new Uint8Array([1, 2, 3, 4, 5, 6])
    }
    const c = {
      width: 2,
      height: 1,
      kind: IMAGE_KIND.RGB_24BPP,
      data: new Uint8Array([9, 2, 3, 4, 5, 6])
    }
    expect(imageContentFingerprint(a)).toBe(imageContentFingerprint(b))
    expect(imageContentFingerprint(a)).not.toBe(imageContentFingerprint(c))
  })
})
