const LOOPBACK_FRAME_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3500'
]

export function loopbackTwinOrigin(pageOrigin: string): string | null {
  try {
    const url = new URL(pageOrigin)
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1'
      return url.origin
    }
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost'
      return url.origin
    }
  } catch {
    return null
  }
  return null
}

export function previewDocumentSrc(path: string, pageOrigin: string): string {
  if (!path.startsWith('/')) return path
  const twin = loopbackTwinOrigin(pageOrigin)
  return twin ? `${twin}${path}` : path
}

/** Script-free crawl snapshot used only when live preview is unavailable. */
export function freezeFrameSandbox(): string {
  return 'allow-forms allow-same-origin allow-popups'
}

/** JS-enabled Inspector iframe. Same-origin only on localhost / 127.0.0.1 twins. */
export function livePreviewSandbox(pageOrigin: string): string {
  const flags = 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals'
  return loopbackTwinOrigin(pageOrigin) ? `${flags} allow-same-origin` : flags
}

export function livePreviewFrameAncestors(appUrl?: string | null): string {
  const origins = new Set<string>(["'self'"])
  for (const raw of [appUrl, ...LOOPBACK_FRAME_ORIGINS]) {
    if (!raw) continue
    try {
      origins.add(new URL(raw).origin)
    } catch {
      // ignore invalid app URLs
    }
  }
  return `frame-ancestors ${[...origins].join(' ')}`
}
