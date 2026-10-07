import type PocketBase from 'pocketbase'

/** Default PocketBase API timeout. Avoids multi-minute hangs when the API is down. */
export const PB_FETCH_TIMEOUT_MS = 12_000

/** Tenant org-context lookup timeout during app boot. */
export const TENANT_CONTEXT_TIMEOUT_MS = 8_000

/** Max wait for the PocketBase client plugin before auth middleware proceeds. */
export const AUTH_READY_TIMEOUT_MS = 5_000

export function abortSignalWithTimeout(
  timeoutMs: number,
  existing?: AbortSignal | null
): AbortSignal {
  if (existing) return existing

  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
  return controller.signal
}

export function mergeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const active = signals.filter(signal => !signal.aborted)
  if (!active.length) {
    return AbortSignal.abort()
  }
  if (active.length === 1) {
    return active[0]!
  }

  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any(active)
  }

  const controller = new AbortController()
  for (const signal of active) {
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

export function attachPocketBaseFetchTimeout(
  pb: PocketBase,
  timeoutMs: number = PB_FETCH_TIMEOUT_MS,
  extraSignal?: () => AbortSignal | undefined
): void {
  const previous = pb.beforeSend

  pb.beforeSend = (url, options) => {
    const merged = previous ? previous(url, options) : { url, options }
    const signals = [
      extraSignal?.(),
      merged.options.signal,
      abortSignalWithTimeout(timeoutMs)
    ].filter((signal): signal is AbortSignal => !!signal)
    merged.options.signal = mergeAbortSignals(...signals)
    return merged
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'Operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
