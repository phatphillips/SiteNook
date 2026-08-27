import PocketBase from 'pocketbase'

let client: PocketBase | null = null
let reauthInFlight: Promise<PocketBase> | null = null

export function getPocketBase(): PocketBase {
  if (!client) {
    const url = process.env.POCKETBASE_URL || 'http://localhost:8090'
    client = new PocketBase(url)
    client.autoCancellation(false)
  }
  return client
}

/** Drop the cached client so the next call resolves DNS/IP again (e.g. after PB recreate). */
export function resetPocketBaseClient(): void {
  client = null
  reauthInFlight = null
}

function isAuthRejectedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const status = Number((error as { status?: number }).status)
  return status === 400 || status === 401 || status === 403
}

export async function authenticateAdmin(maxAttempts = Infinity, delayMs = 2000): Promise<PocketBase> {
  const email = process.env.POCKETBASE_ADMIN_EMAIL
  const password = process.env.POCKETBASE_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are required')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pb = getPocketBase()
    try {
      await pb.collection('_superusers').authWithPassword(email, password)
      return pb
    } catch (superuserErr) {
      try {
        await pb.admins.authWithPassword(email, password)
        return pb
      } catch (err) {
        const connectionError = isPocketBaseConnectionError(superuserErr) || isPocketBaseConnectionError(err)
        if (connectionError) {
          resetPocketBaseClient()
          const cap = Number.isFinite(maxAttempts) ? `/${maxAttempts}` : ''
          console.log(`Waiting for PocketBase (attempt ${attempt}${cap})...`)
          if (attempt === maxAttempts) throw err
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        if (isAuthRejectedError(err) || isAuthRejectedError(superuserErr) || attempt === maxAttempts) {
          throw err
        }
        console.log(`Waiting for PocketBase (attempt ${attempt}/${maxAttempts})...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  return getPocketBase()
}

/** Re-authenticate when the auth token is missing/invalid or after connection loss. */
export async function ensureAuthenticated(): Promise<PocketBase> {
  const pb = getPocketBase()
  if (pb.authStore.isValid) return pb
  if (!reauthInFlight) {
    reauthInFlight = authenticateAdmin(5, 1000)
      .catch((err) => {
        resetPocketBaseClient()
        throw err
      })
      .finally(() => {
        reauthInFlight = null
      })
  }
  return reauthInFlight
}

export function isPocketBaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as {
    status?: number
    message?: string
    originalError?: {
      cause?: { code?: string, message?: string }
      code?: string
      message?: string
    }
  }
  if (err.status === 0) return true
  const code = err.originalError?.cause?.code || err.originalError?.code || ''
  if (
    code === 'ECONNREFUSED'
    || code === 'ENOTFOUND'
    || code === 'ECONNRESET'
    || code === 'EAI_AGAIN'
    || code === 'UND_ERR_SOCKET'
  ) return true
  const message = String(
    err.message || err.originalError?.message || err.originalError?.cause?.message || ''
  )
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|other side closed|UND_ERR_SOCKET/i.test(message)
}

export async function withPocketBaseRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number, delayMs?: number, label?: string, resetClient?: boolean }
): Promise<T> {
  const attempts = options?.attempts ?? 6
  const delayMs = options?.delayMs ?? 2000
  const label = options?.label || 'request'
  const resetClient = options?.resetClient !== false
  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isPocketBaseConnectionError(err) || attempt === attempts) throw err
      console.warn(
        `PocketBase ${label} failed (attempt ${attempt}/${attempts}); retrying...`,
        err instanceof Error ? err.message : err
      )
      if (resetClient) {
        resetPocketBaseClient()
        try {
          await authenticateAdmin(8, 1000)
        } catch (authErr) {
          console.warn('PocketBase re-auth after connection loss failed:', authErr)
        }
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastErr
}

export async function batchCreate<T extends Record<string, unknown>>(
  collection: string,
  records: T[],
  batchSize = 50
): Promise<void> {
  if (!records.length) return

  const pb = getPocketBase()
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(record => pb.collection(collection).create(record))
    )

    const failed = results.find(r => r.status === 'rejected')
    if (failed?.status === 'rejected') {
      const index = results.indexOf(failed)
      const reason = failed.reason
      const detail = reason && typeof reason === 'object' && 'message' in reason
        ? String((reason as { message: string }).message)
        : String(reason)
      throw new Error(
        `Failed to create ${collection} record ${i + index + 1}/${records.length}: ${detail}`
      )
    }
  }
}
