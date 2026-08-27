import { describe, expect, it } from 'vitest'
import {
  freezeFrameSandbox,
  livePreviewSandbox,
  previewIframeLayout,
  previewLayoutWidth,
  resolveExplorerPreviewSrc
} from '~/utils/previewViewport'

describe('resolveExplorerPreviewSrc', () => {
  it('prefers the live preview URL over a freeze-frame snapshot', () => {
    expect(resolveExplorerPreviewSrc({
      livePreviewUrl: '/api/live?ticket=1',
      snapshotUrl: '/api/snapshot?ticket=1'
    })).toEqual({ src: '/api/live?ticket=1', kind: 'live' })
  })

  it('falls back to the freeze-frame when live preview is missing', () => {
    expect(resolveExplorerPreviewSrc({
      livePreviewUrl: null,
      snapshotUrl: '/api/snapshot?ticket=1'
    })).toEqual({ src: '/api/snapshot?ticket=1', kind: 'freeze' })
  })

  it('uses the screenshot path when no HTML preview URL exists', () => {
    expect(resolveExplorerPreviewSrc({})).toEqual({ src: null, kind: 'image' })
  })
})

describe('previewIframeLayout', () => {
  it('uses the panel width for fit viewport without scaling', () => {
    const layout = previewIframeLayout('fit', 640, 800)
    expect(previewLayoutWidth('fit', 640)).toBe(640)
    expect(layout).toMatchObject({ width: 640, height: 800, scale: 1, centered: false })
  })

  it('keeps desktop media-query width and scales down to fit the panel', () => {
    const layout = previewIframeLayout('desktop', 640, 800)
    expect(layout.width).toBe(1280)
    expect(layout.scale).toBeCloseTo(0.5)
    expect(layout.height).toBe(1600)
    expect(layout.centered).toBe(false)
  })

  it('does not change the mobile breakpoint when the panel is wider', () => {
    const layout = previewIframeLayout('mobile', 640, 800)
    expect(layout.width).toBe(375)
    expect(layout.scale).toBe(1)
    expect(layout.centered).toBe(true)
  })
})

describe('preview sandboxes', () => {
  it('keeps freeze-frame script-free and enables scripts for live preview', () => {
    expect(freezeFrameSandbox()).not.toContain('allow-scripts')
    expect(livePreviewSandbox('https://app.example.com')).toContain('allow-scripts')
    expect(livePreviewSandbox('https://app.example.com')).not.toContain('allow-same-origin')
    expect(livePreviewSandbox('http://localhost:3500')).toContain('allow-same-origin')
  })
})
