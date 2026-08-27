import { loopbackTwinOrigin } from './previewFrameOrigin'

export type PreviewViewportId = 'fit' | 'desktop' | 'tablet' | 'mobile'
export type ExplorerViewMode = 'preview' | 'html' | 'markdown' | 'gutenberg'

export const PREVIEW_VIEWPORT_WIDTHS = {
  desktop: 1280,
  tablet: 768,
  mobile: 375
} as const

export type ExplorerPreviewKind = 'live' | 'freeze' | 'image'

export function resolveExplorerPreviewSrc(ticket: {
  livePreviewUrl?: string | null
  snapshotUrl?: string | null
}): { src: string | null, kind: ExplorerPreviewKind } {
  if (ticket.livePreviewUrl) return { src: ticket.livePreviewUrl, kind: 'live' }
  if (ticket.snapshotUrl) return { src: ticket.snapshotUrl, kind: 'freeze' }
  return { src: null, kind: 'image' }
}

export function previewLayoutWidth(
  viewport: PreviewViewportId,
  panelWidth: number
): number {
  if (viewport === 'fit') return Math.max(Math.round(panelWidth) || 0, 320)
  return PREVIEW_VIEWPORT_WIDTHS[viewport]
}

export function previewIframeLayout(
  viewport: PreviewViewportId,
  panelWidth: number,
  panelHeight: number
): { width: number, height: number, scale: number, centered: boolean } {
  const width = previewLayoutWidth(viewport, panelWidth)
  const panel = panelWidth > 50 ? panelWidth : width
  const height = Math.max(Math.round(panelHeight) || 0, 1)
  const scale = width > panel ? panel / width : 1
  return {
    width,
    height: scale < 1 ? Math.ceil(height / scale) : height,
    scale,
    centered: scale === 1 && width < panel
  }
}

/** Script-free crawl snapshot used only when live preview is unavailable. */
export function freezeFrameSandbox(): string {
  return 'allow-forms allow-same-origin allow-popups'
}

export function livePreviewSandbox(pageOrigin: string): string {
  const flags = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals'
  return loopbackTwinOrigin(pageOrigin) ? `${flags} allow-same-origin` : flags
}
