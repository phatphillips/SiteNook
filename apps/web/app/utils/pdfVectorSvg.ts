/**
 * PDF path → SVG export (ImagesTool-style).
 * Builds a page preview SVG plus individual cropped SVG objects
 * (Form XObjects and spatially clustered path groups).
 */
export type ExtractedPdfSvgPage = {
  page: number
  width: number
  height: number
  svg: string
  pathCount: number
  rawPathCount: number
}
export type ExtractedSvgObject = {
  id: string
  name: string
  page: number
  svg: string
  objectUrl: string
  width: number
  height: number
  pathCount: number
  kind: 'form' | 'cluster'
}
export type ExtractedPdfVectors = {
  pages: ExtractedPdfSvgPage[]
  objects: ExtractedSvgObject[]
}
type PdfJsPage = {
  getViewport: (opts: { scale: number }) => { width: number, height: number }
  getOperatorList: (params?: { intent?: string }) => Promise<{
    fnArray: number[]
    argsArray: unknown[][]
  }>
}
type PdfJsDoc = {
  numPages: number
  getPage: (page: number) => Promise<PdfJsPage>
}
type Matrix = [number, number, number, number, number, number]
type GraphicsState = {
  ctm: Matrix
  fillRgb: [number, number, number]
  strokeRgb: [number, number, number]
  fillOpacity: number
  strokeOpacity: number
  lineWidth: number
  blendMode: string
}
type BBox = { minX: number, minY: number, maxX: number, maxY: number }
type PathRecord = {
  d: string
  fill: string
  stroke: string
  fillOpacity: number
  strokeOpacity: number
  lineWidth: number
  evenOdd: boolean
  wantsFill: boolean
  wantsStroke: boolean
  blendMode: string
  bbox: BBox
  formId: number | null
  pageHeight: number
}
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ]
}
function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5]
  ]
}
function scaleOf(m: Matrix): number {
  return Math.hypot(m[0], m[1]) || 1
}
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 1000) / 1000)
}
function rgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`
}
function cloneState(state: GraphicsState): GraphicsState {
  return {
    ctm: [...state.ctm] as Matrix,
    fillRgb: [...state.fillRgb] as [number, number, number],
    strokeRgb: [...state.strokeRgb] as [number, number, number],
    fillOpacity: state.fillOpacity,
    strokeOpacity: state.strokeOpacity,
    lineWidth: state.lineWidth,
    blendMode: state.blendMode
  }
}
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
export function constructPathToSvgD(
  pathOps: number[],
  pathArgs: number[],
  OPS: Record<string, number>,
  ctm?: Matrix
): string {
  const parts: string[] = []
  let j = 0
  let x = 0
  let y = 0
  const map = (px: number, py: number): [number, number] =>
    ctm ? applyMatrix(ctm, px, py) : [px, py]
  for (let i = 0; i < pathOps.length; i++) {
    const op = pathOps[i]! | 0
    if (op === OPS.rectangle) {
      const rx = pathArgs[j++]!
      const ry = pathArgs[j++]!
      const w = pathArgs[j++]!
      const h = pathArgs[j++]!
      const [x0, y0] = map(rx, ry)
      const [x1, y1] = map(rx + w, ry)
      const [x2, y2] = map(rx + w, ry + h)
      const [x3, y3] = map(rx, ry + h)
      parts.push(`M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}L${fmt(x3)} ${fmt(y3)}Z`)
      x = rx
      y = ry
      continue
    }
    if (op === OPS.moveTo) {
      x = pathArgs[j++]!
      y = pathArgs[j++]!
      const [mx, my] = map(x, y)
      parts.push(`M${fmt(mx)} ${fmt(my)}`)
      continue
    }
    if (op === OPS.lineTo) {
      x = pathArgs[j++]!
      y = pathArgs[j++]!
      const [lx, ly] = map(x, y)
      parts.push(`L${fmt(lx)} ${fmt(ly)}`)
      continue
    }
    if (op === OPS.curveTo) {
      const c1x = pathArgs[j++]!
      const c1y = pathArgs[j++]!
      const c2x = pathArgs[j++]!
      const c2y = pathArgs[j++]!
      x = pathArgs[j++]!
      y = pathArgs[j++]!
      const [a, b] = map(c1x, c1y)
      const [c, d] = map(c2x, c2y)
      const [e, f] = map(x, y)
      parts.push(`C${fmt(a)} ${fmt(b)} ${fmt(c)} ${fmt(d)} ${fmt(e)} ${fmt(f)}`)
      continue
    }
    if (op === OPS.curveTo2) {
      const c1x = x
      const c1y = y
      const c2x = pathArgs[j++]!
      const c2y = pathArgs[j++]!
      x = pathArgs[j++]!
      y = pathArgs[j++]!
      const [a, b] = map(c1x, c1y)
      const [c, d] = map(c2x, c2y)
      const [e, f] = map(x, y)
      parts.push(`C${fmt(a)} ${fmt(b)} ${fmt(c)} ${fmt(d)} ${fmt(e)} ${fmt(f)}`)
      continue
    }
    if (op === OPS.curveTo3) {
      const c1x = pathArgs[j++]!
      const c1y = pathArgs[j++]!
      x = pathArgs[j++]!
      y = pathArgs[j++]!
      const [a, b] = map(c1x, c1y)
      const [e, f] = map(x, y)
      parts.push(`C${fmt(a)} ${fmt(b)} ${fmt(e)} ${fmt(f)} ${fmt(e)} ${fmt(f)}`)
      continue
    }
    if (op === OPS.closePath) parts.push('Z')
  }
  return parts.join('')
}
/** Bounding box from SVG path `d` (M/L/C/Z). */
export function bboxFromPathD(d: string): BBox | null {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (!nums || nums.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i])
    const y = Number(nums[i + 1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}
function unionBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}
function expandBBox(b: BBox, pad: number): BBox {
  return {
    minX: b.minX - pad,
    minY: b.minY - pad,
    maxX: b.maxX + pad,
    maxY: b.maxY + pad
  }
}
function bboxesOverlap(a: BBox, b: BBox): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY)
}
function bboxArea(b: BBox): number {
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY)
}
function applyGState(state: GraphicsState, entries: unknown) {
  if (!Array.isArray(entries)) return
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue
    const key = entry[0]
    const value = entry[1]
    if (key === 'ca' && typeof value === 'number') state.fillOpacity = value
    if (key === 'CA' && typeof value === 'number') state.strokeOpacity = value
    if (key === 'LW' && typeof value === 'number') state.lineWidth = value
    if (key === 'BM' && typeof value === 'string') state.blendMode = value
  }
}
function blendToCss(bm: string): string | null {
  const map: Record<string, string> = {
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    difference: 'difference',
    exclusion: 'exclusion'
  }
  return map[bm] || null
}
function pathMarkup(path: PathRecord, offsetX = 0, offsetY = 0): string {
  let d = path.d
  if (offsetX || offsetY) {
    // Translate path into object-local coords (PDF space, still y-up here)
    d = translatePathD(path.d, -offsetX, -offsetY)
  }
  const fill = path.wantsFill ? escapeAttr(path.fill) : 'none'
  const stroke = path.wantsStroke ? escapeAttr(path.stroke) : 'none'
  const fillOp = path.wantsFill && path.fillOpacity < 0.999 ? ` fill-opacity="${fmt(path.fillOpacity)}"` : ''
  const strokeOp = path.wantsStroke && path.strokeOpacity < 0.999 ? ` stroke-opacity="${fmt(path.strokeOpacity)}"` : ''
  const sw = path.wantsStroke ? ` stroke-width="${fmt(path.lineWidth)}"` : ''
  const fr = path.wantsFill && path.evenOdd ? ' fill-rule="evenodd"' : ''
  const blend = blendToCss(path.blendMode)
  const style = blend ? ` style="mix-blend-mode:${blend}"` : ''
  return `<path d="${d}" fill="${fill}" stroke="${stroke}"${sw}${fillOp}${strokeOp}${fr}${style}/>`
}
/** Shift all absolute coords in a simple M/L/C/Z path. */
export function translatePathD(d: string, dx: number, dy: number): string {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    if (/^[MLCZmlcz]$/.test(t)) {
      out.push(t.toUpperCase())
      i++
      const count = t.toUpperCase() === 'C' ? 6 : t.toUpperCase() === 'Z' ? 0 : 2
      for (let n = 0; n < count; n += 2) {
        const x = Number(tokens[i++]!) + dx
        const y = Number(tokens[i++]!) + dy
        out.push(fmt(x), fmt(y))
      }
      continue
    }
    i++
  }
  // Rejoin: commands then pairs
  let result = ''
  let j = 0
  while (j < out.length) {
    const cmd = out[j]!
    if (cmd === 'Z') {
      result += 'Z'
      j++
      continue
    }
    if (cmd === 'M' || cmd === 'L') {
      result += `${cmd}${out[j + 1]} ${out[j + 2]}`
      j += 3
      continue
    }
    if (cmd === 'C') {
      result += `C${out[j + 1]} ${out[j + 2]} ${out[j + 3]} ${out[j + 4]} ${out[j + 5]} ${out[j + 6]}`
      j += 7
      continue
    }
    j++
  }
  return result
}
function buildObjectSvg(paths: PathRecord[], pageHeight: number): { svg: string, width: number, height: number } {
  let box = paths[0]!.bbox
  for (let i = 1; i < paths.length; i++) box = unionBBox(box, paths[i]!.bbox)
  const pad = 1
  const minX = box.minX - pad
  const minY = box.minY - pad
  const width = Math.max(1, box.maxX - box.minX + pad * 2)
  const height = Math.max(1, box.maxY - box.minY + pad * 2)
  // Paths are in PDF y-up; flip for SVG and shift to local origin
  const markup = paths.map(p => pathMarkup(p, minX, minY)).join('\n')
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    `<g transform="matrix(1 0 0 -1 0 ${fmt(height)})">`,
    markup,
    '</g>',
    '</svg>'
  ].join('\n')
  return { svg, width, height }
}
/**
 * Group Form XObject path sets and spatially cluster remaining page paths
 * into downloadable SVG objects.
 */
export function pathsToSvgObjects(
  paths: PathRecord[],
  page: number,
  options?: { clusterPad?: number, minArea?: number }
): Omit<ExtractedSvgObject, 'objectUrl'>[] {
  const clusterPad = options?.clusterPad ?? 12
  const minArea = options?.minArea ?? 24
  const out: Omit<ExtractedSvgObject, 'objectUrl'>[] = []
  const byForm = new Map<number, PathRecord[]>()
  const free: PathRecord[] = []
  for (const path of paths) {
    if (path.formId != null) {
      const list = byForm.get(path.formId) || []
      list.push(path)
      byForm.set(path.formId, list)
    } else {
      free.push(path)
    }
  }
  let objectIndex = 0
  const pushGroup = (group: PathRecord[], kind: 'form' | 'cluster', label: string) => {
    if (!group.length) return
    let box = group[0]!.bbox
    for (let i = 1; i < group.length; i++) box = unionBBox(box, group[i]!.bbox)
    if (bboxArea(box) < minArea && group.length < 3) return
    objectIndex += 1
    const { svg, width, height } = buildObjectSvg(group, group[0]!.pageHeight)
    out.push({
      id: `p${page}-${kind}-${objectIndex}`,
      name: `obj-${String(objectIndex).padStart(3, '0')}-p${page}-${label}.svg`,
      page,
      svg,
      width,
      height,
      pathCount: group.length,
      kind
    })
  }
  for (const [formId, group] of byForm) {
    pushGroup(group, 'form', `form${formId}`)
  }
  // Union-find spatial clustering for page-level paths
  const n = free.length
  const parent = free.map((_, i) => i)
  const find = (i: number): number => {
    let x = i
    while (parent[x] !== x) x = parent[x]!
    return x
  }
  const unite = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  const expanded = free.map(p => expandBBox(p.bbox, clusterPad))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bboxesOverlap(expanded[i]!, expanded[j]!)) unite(i, j)
    }
  }
  const clusters = new Map<number, PathRecord[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const list = clusters.get(root) || []
    list.push(free[i]!)
    clusters.set(root, list)
  }
  for (const group of clusters.values()) {
    pushGroup(group, 'cluster', `cluster${group.length}p`)
  }
  // Larger objects first
  out.sort((a, b) => (b.width * b.height) - (a.width * a.height))
  return out
}
export function operatorListToSvg(
  fnArray: number[],
  argsArray: unknown[][],
  OPS: Record<string, number>,
  width: number,
  height: number,
  options?: { maxPaths?: number }
): { svg: string, pathCount: number, rawPathCount: number, paths: PathRecord[] } {
  const maxPaths = options?.maxPaths ?? 100000
  const stateStack: GraphicsState[] = []
  let state: GraphicsState = {
    ctm: [...IDENTITY] as Matrix,
    fillRgb: [0, 0, 0],
    strokeRgb: [0, 0, 0],
    fillOpacity: 1,
    strokeOpacity: 1,
    lineWidth: 1,
    blendMode: 'Normal'
  }
  let pendingD = ''
  const defs: string[] = []
  const body: string[] = []
  const paths: PathRecord[] = []
  let clipId = 0
  let pathCount = 0
  const clipStack: string[] = []
  const clipDepthAtSave: number[] = []
  let clipPendingD: string | null = null
  let clipPendingEo = false
  let openGroupDepth = 0
  let formIdCounter = 0
  let activeFormId: number | null = null
  const formIdStack: Array<number | null> = []
  const ensureClipGroups = () => {
    while (openGroupDepth < clipStack.length) {
      body.push(`<g clip-path="url(#${clipStack[openGroupDepth]!})">`)
      openGroupDepth += 1
    }
    while (openGroupDepth > clipStack.length) {
      body.push('</g>')
      openGroupDepth -= 1
    }
  }
  const emitPath = (mode: 'fill' | 'eofill' | 'stroke' | 'fillstroke' | 'eofillstroke') => {
    if (!pendingD || pathCount >= maxPaths) {
      pendingD = ''
      return
    }
    ensureClipGroups()
    const wantsFill = mode.includes('fill')
    const wantsStroke = mode.includes('stroke')
    const evenOdd = mode.startsWith('eo')
    const fill = wantsFill ? escapeAttr(rgbCss(state.fillRgb)) : 'none'
    const stroke = wantsStroke ? escapeAttr(rgbCss(state.strokeRgb)) : 'none'
    const fillOp = wantsFill && state.fillOpacity < 0.999 ? ` fill-opacity="${fmt(state.fillOpacity)}"` : ''
    const strokeOp = wantsStroke && state.strokeOpacity < 0.999 ? ` stroke-opacity="${fmt(state.strokeOpacity)}"` : ''
    const lineWidth = state.lineWidth * scaleOf(state.ctm)
    const sw = wantsStroke ? ` stroke-width="${fmt(lineWidth)}"` : ''
    const fr = wantsFill && evenOdd ? ' fill-rule="evenodd"' : ''
    const blend = blendToCss(state.blendMode)
    const style = blend ? ` style="mix-blend-mode:${blend}"` : ''
    body.push(
      `<path d="${pendingD}" fill="${fill}" stroke="${stroke}"${sw}${fillOp}${strokeOp}${fr}${style}/>`
    )
    const bbox = bboxFromPathD(pendingD)
    if (bbox) {
      paths.push({
        d: pendingD,
        fill: rgbCss(state.fillRgb),
        stroke: rgbCss(state.strokeRgb),
        fillOpacity: state.fillOpacity,
        strokeOpacity: state.strokeOpacity,
        lineWidth,
        evenOdd,
        wantsFill,
        wantsStroke,
        blendMode: state.blendMode,
        bbox,
        formId: activeFormId,
        pageHeight: height
      })
    }
    pathCount += 1
    pendingD = ''
  }
  const installClip = (evenOdd: boolean) => {
    if (!clipPendingD) return
    clipId += 1
    const id = `clip${clipId}`
    const fr = evenOdd ? ' clip-rule="evenodd"' : ''
    defs.push(`<clipPath id="${id}"><path d="${clipPendingD}"${fr}/></clipPath>`)
    clipStack.push(id)
    clipPendingD = null
    clipPendingEo = false
  }
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!
    const args = argsArray[i] || []
    if (fn === OPS.save) {
      stateStack.push(cloneState(state))
      clipDepthAtSave.push(clipStack.length)
      continue
    }
    if (fn === OPS.restore) {
      const prev = stateStack.pop()
      const depth = clipDepthAtSave.pop()
      if (typeof depth === 'number') {
        while (clipStack.length > depth) clipStack.pop()
      }
      if (prev) state = prev
      pendingD = ''
      clipPendingD = null
      continue
    }
    if (fn === OPS.transform) {
      const m = args as number[]
      if (m.length >= 6) {
        state.ctm = multiply(state.ctm, [m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!])
      }
      continue
    }
    if (fn === OPS.paintFormXObjectBegin) {
      stateStack.push(cloneState(state))
      clipDepthAtSave.push(clipStack.length)
      formIdStack.push(activeFormId)
      formIdCounter += 1
      activeFormId = formIdCounter
      const matrix = args[0]
      if (Array.isArray(matrix) && matrix.length >= 6) {
        const m = matrix as number[]
        state.ctm = multiply(state.ctm, [m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!])
      }
      continue
    }
    if (fn === OPS.paintFormXObjectEnd) {
      const prev = stateStack.pop()
      const depth = clipDepthAtSave.pop()
      if (typeof depth === 'number') {
        while (clipStack.length > depth) clipStack.pop()
      }
      activeFormId = formIdStack.pop() ?? null
      if (prev) state = prev
      pendingD = ''
      continue
    }
    if (fn === OPS.setFillRGBColor) {
      state.fillRgb = [
        Math.round(Number(args[0]) || 0),
        Math.round(Number(args[1]) || 0),
        Math.round(Number(args[2]) || 0)
      ]
      continue
    }
    if (fn === OPS.setFillGray) {
      const g0 = Number(args[0]) || 0
      const g = g0 <= 1 ? Math.round(g0 * 255) : Math.round(g0)
      state.fillRgb = [g, g, g]
      continue
    }
    if (fn === OPS.setStrokeRGBColor) {
      state.strokeRgb = [
        Math.round(Number(args[0]) || 0),
        Math.round(Number(args[1]) || 0),
        Math.round(Number(args[2]) || 0)
      ]
      continue
    }
    if (fn === OPS.setStrokeGray) {
      const g0 = Number(args[0]) || 0
      const g = g0 <= 1 ? Math.round(g0 * 255) : Math.round(g0)
      state.strokeRgb = [g, g, g]
      continue
    }
    if (fn === OPS.setGState) {
      applyGState(state, args[0])
      continue
    }
    if (fn === OPS.setLineWidth && typeof args[0] === 'number') {
      state.lineWidth = args[0]
      continue
    }
    if (fn === OPS.constructPath) {
      const pathOps = args[0] as number[] | undefined
      const pathArgs = args[1] as number[] | undefined
      if (Array.isArray(pathOps) && Array.isArray(pathArgs)) {
        const d = constructPathToSvgD(pathOps, pathArgs, OPS, state.ctm)
        pendingD = pendingD ? `${pendingD}${d}` : d
      }
      continue
    }
    if (fn === OPS.clip || fn === OPS.eoClip) {
      clipPendingD = pendingD
      clipPendingEo = fn === OPS.eoClip
      continue
    }
    if (fn === OPS.endPath) {
      if (clipPendingD) installClip(clipPendingEo)
      pendingD = ''
      clipPendingD = null
      continue
    }
    if (fn === OPS.fill) {
      emitPath('fill')
      continue
    }
    if (fn === OPS.fillStroke || fn === OPS.closeFillStroke) {
      emitPath('fillstroke')
      continue
    }
    if (fn === OPS.eoFill) {
      emitPath('eofill')
      continue
    }
    if (fn === OPS.eoFillStroke || fn === OPS.closeEOFillStroke) {
      emitPath('eofillstroke')
      continue
    }
    if (fn === OPS.stroke || fn === OPS.closeStroke) {
      emitPath('stroke')
      continue
    }
  }
  while (openGroupDepth > 0) {
    body.push('</g>')
    openGroupDepth -= 1
  }
  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    defs.length ? `<defs>\n${defs.join('\n')}\n</defs>` : '',
    `<g id="page-paths" transform="matrix(1 0 0 -1 0 ${fmt(height)})">`,
    ...body,
    '</g>',
    '</svg>'
  ].filter(Boolean).join('\n')
  return { svg, pathCount, rawPathCount: pathCount, paths }
}
export async function extractPdfVectors(
  pdfDoc: PdfJsDoc,
  options?: { maxPages?: number, maxPaths?: number, clusterPad?: number, minArea?: number }
): Promise<ExtractedPdfVectors> {
  const pdfjs = await import('pdfjs-dist')
  const OPS = pdfjs.OPS as Record<string, number>
  const maxPages = Math.min(pdfDoc.numPages, options?.maxPages ?? 100)
  const pages: ExtractedPdfSvgPage[] = []
  const objects: ExtractedSvgObject[] = []
  const encoder = new TextEncoder()
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const ops = await page.getOperatorList({ intent: 'display' })
    const { svg, pathCount, rawPathCount, paths } = operatorListToSvg(
      ops.fnArray,
      ops.argsArray,
      OPS,
      viewport.width,
      viewport.height,
      options
    )
    pages.push({
      page: pageNum,
      width: viewport.width,
      height: viewport.height,
      svg,
      pathCount,
      rawPathCount
    })
    const pageObjects = pathsToSvgObjects(paths, pageNum, {
      clusterPad: options?.clusterPad,
      minArea: options?.minArea
    })
    for (const obj of pageObjects) {
      const blob = new Blob([encoder.encode(obj.svg)], { type: 'image/svg+xml' })
      objects.push({
        ...obj,
        objectUrl: URL.createObjectURL(blob)
      })
    }
  }
  return { pages, objects }
}
/** @deprecated Prefer extractPdfVectors */
export async function extractAllPdfPageVectorsAsSvg(
  pdfDoc: PdfJsDoc,
  options?: { maxPages?: number, maxPaths?: number }
): Promise<ExtractedPdfSvgPage[]> {
  const result = await extractPdfVectors(pdfDoc, options)
  return result.pages
}
export function revokeExtractedSvgObjects(objects: ExtractedSvgObject[]) {
  for (const obj of objects) URL.revokeObjectURL(obj.objectUrl)
}
export async function zipExtractedSvgObjects(objects: ExtractedSvgObject[]): Promise<Uint8Array> {
  const { zipStoreFiles } = await import('~/utils/zipStore')
  const files: Record<string, Uint8Array> = {}
  const encoder = new TextEncoder()
  for (const obj of objects) {
    files[obj.name] = encoder.encode(obj.svg)
  }
  return zipStoreFiles(files)
}
/** @deprecated Prefer zipExtractedSvgObjects */
export async function zipExtractedSvgs(pages: ExtractedPdfSvgPage[]): Promise<Uint8Array> {
  const { zipStoreFiles } = await import('~/utils/zipStore')
  const files: Record<string, Uint8Array> = {}
  const encoder = new TextEncoder()
  for (const page of pages) {
    files[`page-${String(page.page).padStart(3, '0')}-paths.svg`] = encoder.encode(page.svg)
  }
  return zipStoreFiles(files)
}
