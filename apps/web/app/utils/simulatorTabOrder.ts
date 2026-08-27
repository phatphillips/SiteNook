/** Focusable tab-order entry with document-space geometry (CSS pixels). */
export interface SimulatorTabOrderEntry {
  index: number
  tag: string
  role: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface SimulatorTabOrderPayload {
  pageWidth: number
  pageHeight: number
  entries: SimulatorTabOrderEntry[]
}

export interface ScaledTabMarker {
  index: number
  label: string
  /** CSS left/top relative to the displayed image box (px). */
  left: number
  top: number
}

/**
 * Scale document-space tab markers onto the displayed screenshot size.
 * Uses pageWidth/pageHeight from capture when available; falls back to natural image size.
 */
export function scaleTabOrderMarkers(
  payload: SimulatorTabOrderPayload | null | undefined,
  displayWidth: number,
  displayHeight: number,
  imageNaturalWidth?: number,
  imageNaturalHeight?: number
): ScaledTabMarker[] {
  if (!payload?.entries?.length || displayWidth <= 0 || displayHeight <= 0) return []

  const sourceWidth = payload.pageWidth > 0
    ? payload.pageWidth
    : (imageNaturalWidth && imageNaturalWidth > 0 ? imageNaturalWidth : displayWidth)
  const sourceHeight = payload.pageHeight > 0
    ? payload.pageHeight
    : (imageNaturalHeight && imageNaturalHeight > 0 ? imageNaturalHeight : displayHeight)

  if (sourceWidth <= 0 || sourceHeight <= 0) return []

  const scaleX = displayWidth / sourceWidth
  const scaleY = displayHeight / sourceHeight

  return payload.entries.map((entry) => ({
    index: entry.index,
    label: entry.name || entry.role || entry.tag || String(entry.index),
    left: Math.max(0, entry.x * scaleX),
    top: Math.max(0, entry.y * scaleY)
  }))
}

/** Pure helper for unit tests — order focusable-like descriptors by tabindex rules. */
export function orderTabCandidates<T extends { tabindex: number }>(nodes: T[]): T[] {
  const positive = nodes
    .filter(n => n.tabindex > 0)
    .sort((a, b) => a.tabindex - b.tabindex)
  const zero = nodes.filter(n => n.tabindex === 0)
  return [...positive, ...zero]
}
