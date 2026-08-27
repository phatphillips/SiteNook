export type PdfInspectorPaneView =
  | 'pdf'
  | 'html'
  | 'json'
  | 'markdown'
  | 'gutenberg'
  | 'image'

/** Formats allowed in the Convert Content pane (middle preview is always PDF). */
export type PdfContentPaneView = Exclude<PdfInspectorPaneView, 'pdf'>

export type PdfStudioMode = 'audit' | 'convert' | 'compare'

const PANE_VIEWS: PdfInspectorPaneView[] = [
  'pdf',
  'html',
  'json',
  'markdown',
  'gutenberg',
  'image'
]
const CONTENT_VIEWS: PdfContentPaneView[] = [
  'html',
  'json',
  'markdown',
  'gutenberg',
  'image'
]
const STUDIO_MODES: PdfStudioMode[] = ['audit', 'convert', 'compare']

export function isPdfInspectorPaneView(value: unknown): value is PdfInspectorPaneView {
  return typeof value === 'string' && (PANE_VIEWS as string[]).includes(value)
}

export function isPdfContentPaneView(value: unknown): value is PdfContentPaneView {
  return typeof value === 'string' && (CONTENT_VIEWS as string[]).includes(value)
}

export function isPdfStudioMode(value: unknown): value is PdfStudioMode {
  return typeof value === 'string' && (STUDIO_MODES as string[]).includes(value)
}

/** Normalize legacy `structure` query value to `convert`. */
export function normalizePdfStudioMode(value: unknown): PdfStudioMode {
  if (value === 'structure') return 'convert'
  return isPdfStudioMode(value) ? value : 'audit'
}

/**
 * Parse studio query. Middle preview is always PDF.
 * Content format: `content` preferred, else `view2`; `pdf` is coerced to markdown.
 */
export function parsePdfStudioQuery(query: Record<string, unknown> | {
  mode?: unknown
  view1?: unknown
  view2?: unknown
  content?: unknown
}): {
  mode: PdfStudioMode
  view1: PdfInspectorPaneView
  view2: PdfContentPaneView
  content: PdfContentPaneView
} {
  const mode = normalizePdfStudioMode(query.mode)
  const view1 = isPdfInspectorPaneView(query.view1) ? query.view1 : 'pdf'
  const rawContent = query.content ?? query.view2
  const content: PdfContentPaneView = isPdfContentPaneView(rawContent) ? rawContent : 'markdown'
  return { mode, view1, view2: content, content }
}

/** PDF points bbox [left, bottom, right, top] → css overlay on a fitted page. */
export function bboxToCssOverlay(
  bbox: number[],
  pageWidthPts: number,
  pageHeightPts: number,
  renderWidth: number,
  renderHeight: number
): { left: number, top: number, width: number, height: number } | null {
  if (bbox.length < 4 || pageWidthPts <= 0 || pageHeightPts <= 0) return null
  const [left, bottom, right, top] = bbox.map(Number)
  if (![left, bottom, right, top].every(Number.isFinite)) return null
  const scaleX = renderWidth / pageWidthPts
  const scaleY = renderHeight / pageHeightPts
  const x = left * scaleX
  const y = (pageHeightPts - top) * scaleY
  const width = Math.max(0, (right - left) * scaleX)
  const height = Math.max(0, (top - bottom) * scaleY)
  return { left: x, top: y, width, height }
}

/**
 * Fit a PDF page width into a container (minus horizontal chrome).
 * Clamped to 0.4–1.5 so pages stay readable without oversizing.
 */
export function fitPdfPreviewScale(
  pageWidthPts: number,
  containerWidthPx: number,
  paddingPx = 48
): number {
  if (pageWidthPts <= 0) return 1
  const usable = Math.max(containerWidthPx - paddingPx, 120)
  return Math.min(1.5, Math.max(0.4, usable / pageWidthPts))
}

export const PDF_CONVERT_PANE_OPTIONS: { label: string, value: PdfInspectorPaneView }[] = [
  { label: 'PDF', value: 'pdf' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Gutenberg', value: 'gutenberg' },
  { label: 'Image assets', value: 'image' }
]

export const PDF_CONTENT_PANE_OPTIONS: { label: string, value: PdfContentPaneView }[] = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
  { label: 'Gutenberg', value: 'gutenberg' },
  { label: 'Image assets', value: 'image' }
]

export function isPdfConvertTextView(view: PdfInspectorPaneView): boolean {
  return view === 'html' || view === 'json' || view === 'markdown' || view === 'gutenberg'
}
