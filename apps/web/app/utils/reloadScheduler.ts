/** Debounced async reload with in-flight guard and at-most-one queued follow-up. */
export function createDebouncedReload(run: () => Promise<void>, delayMs = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let queued = false

  async function flush() {
    if (inFlight) {
      queued = true
      return
    }
    inFlight = true
    try {
      await run()
    } finally {
      inFlight = false
      if (queued) {
        queued = false
        await flush()
      }
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      flush().catch(() => {})
    }, delayMs)
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { schedule, cancel, flush }
}
