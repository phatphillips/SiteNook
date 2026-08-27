import { describe, expect, it } from 'vitest'
import {
  freezeFrameSandbox,
  livePreviewFrameAncestors,
  livePreviewSandbox,
  loopbackTwinOrigin,
  previewDocumentSrc
} from '~/utils/previewFrameOrigin'

describe('previewFrameOrigin', () => {
  it('maps localhost to 127.0.0.1 and back', () => {
    expect(loopbackTwinOrigin('http://localhost:3500')).toBe('http://127.0.0.1:3500')
    expect(loopbackTwinOrigin('http://127.0.0.1:3500')).toBe('http://localhost:3500')
    expect(loopbackTwinOrigin('https://app.example.com')).toBeNull()
  })

  it('loads the preview document from the loopback twin origin', () => {
    expect(previewDocumentSrc('/api/preview?ticket=1', 'http://localhost:3500'))
      .toBe('http://127.0.0.1:3500/api/preview?ticket=1')
    expect(previewDocumentSrc('/api/preview?ticket=1', 'https://app.example.com'))
      .toBe('/api/preview?ticket=1')
  })

  it('uses a script-free sandbox for freeze-frame page preview', () => {
    expect(freezeFrameSandbox()).toBe('allow-forms allow-same-origin allow-popups')
    expect(freezeFrameSandbox()).not.toContain('allow-scripts')
  })

  it('only adds allow-same-origin when the iframe is on the loopback twin', () => {
    expect(livePreviewSandbox('http://localhost:3500')).toContain('allow-same-origin')
    expect(livePreviewSandbox('https://app.example.com')).not.toContain('allow-same-origin')
  })

  it('allows both loopback hosts to embed the preview', () => {
    const value = livePreviewFrameAncestors('http://localhost:3500')
    expect(value).toContain('http://localhost:3500')
    expect(value).toContain('http://127.0.0.1:3500')
  })
})
