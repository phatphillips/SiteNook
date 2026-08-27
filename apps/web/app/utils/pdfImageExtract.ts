export type ExtractedPdfImage = {
  name: string
  mimeType: string
  data: Uint8Array
  objectUrl: string
  page: number
  width: number
  height: number
}

export type PdfJsImageData = {
  width: number
  height: number
  kind?: number
  data?: Uint8ClampedArray | Uint8Array | string
  bitmap?: ImageBitmap | HTMLCanvasElement | ImageData
  count?: number
}

type PdfJsObjStore = {
  has?: (id: string) => boolean
  get: (id: string, callback?: (data: PdfJsImageData) => void) => PdfJsImageData | undefined
  [Symbol.iterator]?: () => IterableIterator<[string, unknown]>
}

type PdfJsPage = {
  getOperatorList: (params?: {
    intent?: string
    annotationMode?: number
  }) => Promise<{ fnArray: number[], argsArray: unknown[][] }>
  objs: PdfJsObjStore
  commonObjs?: PdfJsObjStore
}

type PdfJsDoc = {
  numPages: number
  getPage: (page: number) => Promise<PdfJsPage>
  commonObjs: PdfJsObjStore
}

export const IMAGE_KIND = {
  GRAYSCALE_1BPP: 1,
  RGB_24BPP: 2,
  RGBA_32BPP: 3
} as const

const OBJ_TIMEOUT_MS = 2500

export function storeForImageName(
  imgName: string,
  page: PdfJsPage,
  doc: PdfJsDoc
): PdfJsObjStore {
  if (imgName.startsWith('g_')) {
    return page.commonObjs || doc.commonObjs
  }
  return page.objs
}

export function getPdfObj(
  store: PdfJsObjStore | undefined,
  id: string,
  timeoutMs = OBJ_TIMEOUT_MS
): Promise<PdfJsImageData | null> {
  if (!store) return Promise.resolve(null)

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: PdfJsImageData | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    const timer = setTimeout(() => finish(null), timeoutMs)

    try {
      try {
        const sync = store.get(id)
        if (sync && (hasBinaryPayload(sync) || (sync.width && sync.height))) {
          finish(sync)
          return
        }
      } catch {
        // fall through to callback registration
      }

      store.get(id, (data) => finish(data ?? null))
    } catch {
      finish(null)
    }
  })
}

async function resolveImageData(
  page: PdfJsPage,
  doc: PdfJsDoc,
  imgName: string
): Promise<PdfJsImageData | null> {
  const primary = storeForImageName(imgName, page, doc)
  const first = await getPdfObj(primary, imgName)
  if (hasBinaryPayload(first) || (first?.width && first?.height)) return first

  // Fallback: try the other store (some builds mis-prefix shared images).
  const secondary = primary === page.objs
    ? (page.commonObjs || doc.commonObjs)
    : page.objs
  if (secondary && secondary !== primary) {
    const second = await getPdfObj(secondary, imgName)
    if (hasBinaryPayload(second) || (second?.width && second?.height)) return second
  }
  return first
}

/** True when `data` is pixel/JPEG bytes (not a PDF.js object-id string). */
export function hasBinaryPayload(img: PdfJsImageData | null | undefined): boolean {
  if (!img) return false
  if (img.bitmap) return true
  const data = img.data
  return !!data && typeof data !== 'string'
}

/** Content fingerprint so the same bytes under different XObject names are not duplicated. */
export function imageContentFingerprint(img: PdfJsImageData): string {
  if (img.bitmap && typeof ImageBitmap !== 'undefined' && img.bitmap instanceof ImageBitmap) {
    return `bmp:${img.width}x${img.height}:${img.bitmap.width}x${img.bitmap.height}`
  }
  if (!hasBinaryPayload(img)) {
    return `meta:${img.width}x${img.height}:${typeof img.data === 'string' ? img.data : 'empty'}`
  }
  const bytes = img.data as Uint8Array | Uint8ClampedArray
  let hash = (img.width * 73856093) ^ (img.height * 19349663) ^ (bytes.length * 83492791) ^ (img.kind || 0)
  const step = Math.max(1, Math.floor(bytes.length / 64))
  for (let i = 0; i < bytes.length; i += step) {
    hash = (hash * 33) ^ bytes[i]!
  }
  hash = (hash * 33) ^ (bytes[bytes.length - 1] ?? 0)
  return `px:${hash >>> 0}`
}

/**
 * Mask ops pass `{ data: "img_p0_1", width, height }` — `data` is a store id.
 * Resolve those before treating them as pixel buffers.
 */
export function extractImageRefFromArg(arg: unknown): string | null {
  if (typeof arg === 'string' && arg.length > 0) return arg
  if (!arg || typeof arg !== 'object' || Array.isArray(arg)) return null
  const data = (arg as PdfJsImageData).data
  if (typeof data === 'string' && data.length > 0) return data
  return null
}

export function isJpegBytes(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
}

export function rgbaFromPdfImage(img: PdfJsImageData): Uint8ClampedArray | null {
  if (!hasBinaryPayload(img) || !img.width || !img.height) return null
  const raw = img.data as Uint8ClampedArray | Uint8Array
  if (isJpegBytes(raw instanceof Uint8Array ? raw : new Uint8Array(raw))) {
    return null // handled as JPEG blob separately
  }

  const { width, height, kind } = img
  const src = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
  const pixelCount = width * height
  const rgba = new Uint8ClampedArray(pixelCount * 4)

  if (kind === IMAGE_KIND.RGBA_32BPP || src.length === pixelCount * 4) {
    rgba.set(src.subarray(0, rgba.length))
    return rgba
  }

  if (kind === IMAGE_KIND.RGB_24BPP || src.length === pixelCount * 3) {
    for (let i = 0, j = 0; i < pixelCount; i++, j += 3) {
      const o = i * 4
      rgba[o] = src[j]!
      rgba[o + 1] = src[j + 1]!
      rgba[o + 2] = src[j + 2]!
      rgba[o + 3] = 255
    }
    return rgba
  }

  // Gray 8bpp
  if (src.length === pixelCount) {
    for (let i = 0; i < pixelCount; i++) {
      const v = src[i]!
      const o = i * 4
      rgba[o] = v
      rgba[o + 1] = v
      rgba[o + 2] = v
      rgba[o + 3] = 255
    }
    return rgba
  }

  // Packed 1bpp masks (very common for header/footer logos)
  const rowBytes = Math.ceil(width / 8)
  if (kind === IMAGE_KIND.GRAYSCALE_1BPP || src.length === rowBytes * height) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = src[y * rowBytes + (x >> 3)] ?? 0
        const bit = (byte >> (7 - (x & 7))) & 1
        // PDF image masks: 1 = opaque in many writers; keep both discernible
        const v = bit ? 0 : 255
        const o = (y * width + x) * 4
        rgba[o] = v
        rgba[o + 1] = v
        rgba[o + 2] = v
        rgba[o + 3] = bit ? 255 : 0
      }
    }
    return rgba
  }

  if (src.length >= pixelCount * 3) {
    for (let i = 0, j = 0; i < pixelCount; i++, j += 3) {
      const o = i * 4
      rgba[o] = src[j]!
      rgba[o + 1] = src[j + 1]!
      rgba[o + 2] = src[j + 2]!
      rgba[o + 3] = 255
    }
    return rgba
  }

  return null
}

async function bitmapToPng(
  bitmap: ImageBitmap | HTMLCanvasElement | ImageData,
  widthHint?: number,
  heightHint?: number
): Promise<{ data: Uint8Array, objectUrl: string, width: number, height: number } | null> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (typeof ImageData !== 'undefined' && bitmap instanceof ImageData) {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.putImageData(bitmap, 0, 0)
  } else if (typeof HTMLCanvasElement !== 'undefined' && bitmap instanceof HTMLCanvasElement) {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.drawImage(bitmap, 0, 0)
  } else {
    const ib = bitmap as ImageBitmap
    canvas.width = ib.width || widthHint || 0
    canvas.height = ib.height || heightHint || 0
    if (!canvas.width || !canvas.height) return null
    ctx.drawImage(ib, 0, 0)
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    objectUrl: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height
  }
}

async function pdfImageToAsset(img: PdfJsImageData): Promise<{
  data: Uint8Array
  objectUrl: string
  width: number
  height: number
  mimeType: string
} | null> {
  if (img.bitmap) {
    const fromBitmap = await bitmapToPng(img.bitmap, img.width, img.height)
    if (fromBitmap) {
      return { ...fromBitmap, mimeType: 'image/png' }
    }
  }

  if (!hasBinaryPayload(img)) return null

  const bytes = img.data as Uint8ClampedArray | Uint8Array
  if (isJpegBytes(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))) {
    const copy = new Uint8Array(bytes)
    const blob = new Blob([copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer], {
      type: 'image/jpeg'
    })
    return {
      data: copy,
      objectUrl: URL.createObjectURL(blob),
      width: img.width || 0,
      height: img.height || 0,
      mimeType: 'image/jpeg'
    }
  }

  const rgba = rgbaFromPdfImage(img)
  if (!rgba || !img.width || !img.height) return null

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const imageData = ctx.createImageData(img.width, img.height)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    objectUrl: URL.createObjectURL(blob),
    width: img.width,
    height: img.height,
    mimeType: 'image/png'
  }
}

function isPaintImageOp(fn: number, OPS: Record<string, number>): boolean {
  return fn === OPS.paintImageXObject
    || fn === OPS.paintImageXObjectRepeat
    || fn === OPS.paintJpegXObject
    || fn === OPS.paintInlineImageXObject
    || fn === OPS.paintInlineImageXObjectGroup
    || fn === OPS.paintImageMaskXObject
    || fn === OPS.paintImageMaskXObjectGroup
    || fn === OPS.paintImageMaskXObjectRepeat
    || fn === OPS.paintSolidColorImageMask
    || fn === OPS.paintXObject
}

function collectInlineCandidates(args: unknown[]): PdfJsImageData[] {
  const out: PdfJsImageData[] = []

  const consider = (item: unknown) => {
    if (!item || typeof item !== 'object') return
    const obj = item as PdfJsImageData
    if (!obj.width || !obj.height) return
    // Skip unresolved mask refs ({ data: "img_…" }) — those are handled via store lookup.
    if (typeof obj.data === 'string') return
    if (hasBinaryPayload(obj)) out.push(obj)
  }

  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const item of arg) consider(item)
      continue
    }
    consider(arg)
  }
  return out
}

/** Collect image object ids from paint + dependency ops (incl. mask refs). */
export function collectImageObjectIds(
  fnArray: number[],
  argsArray: unknown[][],
  OPS: Record<string, number>
): string[] {
  const ids = new Set<string>()

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!
    const args = argsArray[i] || []

    if (fn === OPS.dependency) {
      for (const dep of args) {
        // Dependencies also list fonts — only keep image-like ids.
        if (typeof dep === 'string' && /img/i.test(dep)) ids.add(dep)
      }
      continue
    }

    if (!isPaintImageOp(fn, OPS)) continue

    const direct = extractImageRefFromArg(args[0])
    if (direct) ids.add(direct)

    // Groups / repeats can nest refs
    for (const arg of args) {
      if (Array.isArray(arg)) {
        for (const item of arg) {
          const nested = extractImageRefFromArg(item)
          if (nested) ids.add(nested)
        }
      } else {
        const nested = extractImageRefFromArg(arg)
        if (nested) ids.add(nested)
      }
    }
  }

  return [...ids]
}

function looksLikeImageObject(data: unknown): data is PdfJsImageData {
  if (!data || typeof data !== 'object') return false
  const img = data as PdfJsImageData
  if (!img.width || !img.height) return false
  return hasBinaryPayload(img)
}

function opDedupeKey(fn: number, args: unknown[]): string {
  const ref = extractImageRefFromArg(args[0])
  if (ref) return `${fn}:${ref}`
  if (typeof args[0] === 'object' && args[0] && 'width' in (args[0] as object)) {
    const img = args[0] as PdfJsImageData
    const len = hasBinaryPayload(img) ? (img.data as Uint8Array).length : 0
    return `${fn}:inline-${img.width}x${img.height}-${len}`
  }
  return `${fn}:${args.length}`
}

async function mergeOperatorLists(
  page: PdfJsPage,
  intents: string[]
): Promise<{ fnArray: number[], argsArray: unknown[][] }> {
  const fnArray: number[] = []
  const argsArray: unknown[][] = []
  const seenKey = new Set<string>()

  for (const intent of intents) {
    try {
      const ops = await page.getOperatorList({ intent })
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]!
        const args = ops.argsArray[i] || []
        const key = opDedupeKey(fn, args)
        if (seenKey.has(key)) continue
        seenKey.add(key)
        fnArray.push(fn)
        argsArray.push(args)
      }
    } catch {
      // Ignore unsupported intent.
    }
  }
  return { fnArray, argsArray }
}

async function sweepResolvedObjs(
  store: PdfJsObjStore | undefined,
  pageNum: number,
  pushAsset: (pageNum: number, img: PdfJsImageData, nameHint: string) => Promise<void>
) {
  if (!store || typeof store[Symbol.iterator] !== 'function') return
  try {
    for (const [id, data] of store[Symbol.iterator]!()) {
      if (typeof id !== 'string') continue
      // Fonts and other shared objs also live here — only take image-shaped payloads.
      if (!looksLikeImageObject(data)) continue
      await pushAsset(pageNum, data, id)
    }
  } catch {
    // Iterator may throw on incomplete stores — ignore.
  }
}

/**
 * Extract embedded image XObjects / masks / inline images from the PDF
 * (including assets used in Form XObjects such as headers/footers).
 */
export async function extractPdfEmbeddedImages(
  pdfDoc: PdfJsDoc,
  options?: { maxPages?: number }
): Promise<ExtractedPdfImage[]> {
  const pdfjs = await import('pdfjs-dist')
  const OPS = pdfjs.OPS as Record<string, number>

  const maxPages = Math.min(pdfDoc.numPages, options?.maxPages ?? 100)
  const images: ExtractedPdfImage[] = []
  const seen = new Set<string>()
  let assetIndex = 0

  async function pushAsset(
    pageNum: number,
    img: PdfJsImageData,
    nameHint: string
  ) {
    const fingerprint = imageContentFingerprint(img)
    if (seen.has(fingerprint)) return
    // Also skip if we already extracted this named XObject
    if (nameHint && seen.has(`name:${nameHint}`)) return

    try {
      const asset = await pdfImageToAsset(img)
      if (!asset) return
      if (!asset.width && !asset.height && asset.mimeType !== 'image/jpeg') return

      seen.add(fingerprint)
      if (nameHint) seen.add(`name:${nameHint}`)
      assetIndex += 1
      const safeName = (nameHint || fingerprint).replace(/[^\w.-]+/g, '_').slice(0, 48)
      const ext = asset.mimeType === 'image/jpeg' ? 'jpg' : 'png'
      images.push({
        name: `asset-${String(assetIndex).padStart(3, '0')}-p${pageNum}-${safeName}.${ext}`,
        mimeType: asset.mimeType,
        data: asset.data,
        objectUrl: asset.objectUrl,
        page: pageNum,
        width: asset.width,
        height: asset.height
      })
    } catch {
      // Skip undecodable image — do not mark as seen so alternate intents can retry.
    }
  }

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    // Display intent is enough; merging print re-enumerates the same paint ops.
    const ops = await mergeOperatorLists(page, ['display'])

    // 1) Resolve every referenced image id (paint ops + dependency ops + mask refs)
    const objectIds = collectImageObjectIds(ops.fnArray, ops.argsArray, OPS)
    for (const id of objectIds) {
      const img = await resolveImageData(page, pdfDoc, id)
      if (img) await pushAsset(pageNum, img, id)
    }

    // 2) Inline images / masks that already carry pixel buffers in the op args
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]!
      if (!isPaintImageOp(fn, OPS)) continue
      for (const inline of collectInlineCandidates(ops.argsArray[i] || [])) {
        await pushAsset(
          pageNum,
          inline,
          `inline-${inline.width}x${inline.height}-${(inline.data as Uint8Array | undefined)?.length ?? 0}`
        )
      }
    }

    // 3) Sweep only for leftover image objs not already reached by paint ops.
    await sweepResolvedObjs(page.objs, pageNum, pushAsset)
    await sweepResolvedObjs(page.commonObjs || pdfDoc.commonObjs, pageNum, pushAsset)
  }

  return images
}

/** @deprecated Prefer extractPdfEmbeddedImages. */
export async function extractPdfPageImages(
  pdfDoc: PdfJsDoc,
  options?: { scale?: number, maxPages?: number }
): Promise<ExtractedPdfImage[]> {
  return extractPdfEmbeddedImages(pdfDoc, options)
}

export function revokeExtractedImages(images: ExtractedPdfImage[]) {
  for (const image of images) {
    URL.revokeObjectURL(image.objectUrl)
  }
}

export async function zipExtractedImages(images: ExtractedPdfImage[]): Promise<Uint8Array> {
  const { zipStoreFiles } = await import('~/utils/zipStore')
  const files: Record<string, Uint8Array> = {}
  for (const image of images) {
    files[image.name] = image.data
  }
  return zipStoreFiles(files)
}

export function downloadUint8Array(data: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], {
    type: mimeType
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function loadPdfJsFromFileUrl(
  fileUrl: string,
  authToken: string | null | undefined
): Promise<PdfJsDoc> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  let data: ArrayBuffer | null = null
  if (fileUrl.startsWith('/api/')) {
    const response = await fetch(fileUrl, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    })
    if (!response.ok) {
      throw new Error(`Could not load PDF for image extract (${response.status})`)
    }
    data = await response.arrayBuffer()
  }

  const task = data
    ? pdfjs.getDocument({ data, isOffscreenCanvasSupported: false })
    : pdfjs.getDocument({ url: fileUrl, isOffscreenCanvasSupported: false })
  return await task.promise as unknown as PdfJsDoc
}

