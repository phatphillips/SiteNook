/**
 * Polar customer-portal licence validation (no Polar access token).
 * organization_id is the SiteNook Polar org (public, like a Stripe publishable key).
 */
export const DEFAULT_POLAR_API_BASE = 'https://api.polar.sh'
export const DEFAULT_POLAR_CHECKOUT_URL =
  'https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j'

export interface PolarLicencePayload {
  id?: string
  status?: string
  expires_at?: string | null
  organization_id?: string
  benefit_id?: string
}

export interface PolarLicenceResult {
  valid: boolean
  status: string
  expiresAt: string | null
  error: string | null
  payload: PolarLicencePayload | null
}

export function resolvePolarApiBase(value?: string): string {
  const raw = (value || '').trim() || DEFAULT_POLAR_API_BASE
  return raw.replace(/\/$/, '')
}

export function isPolarLicenceGranted(payload: PolarLicencePayload | null | undefined): boolean {
  if (!payload) return false
  if (String(payload.status || '').trim().toLowerCase() !== 'granted') return false
  if (payload.expires_at && Date.parse(payload.expires_at) < Date.now()) return false
  return true
}

export async function validatePolarLicenseKey(options: {
  key: string
  organizationId: string
  apiBase?: string
  fetchImpl?: typeof fetch
}): Promise<PolarLicenceResult> {
  const key = options.key.trim()
  const organizationId = options.organizationId.trim()
  if (!key) {
    return { valid: false, status: '', expiresAt: null, error: 'Licence key is required', payload: null }
  }
  if (!organizationId) {
    return {
      valid: false,
      status: '',
      expiresAt: null,
      error: 'SITENOOK_POLAR_ORGANIZATION_ID is not set',
      payload: null
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const url = `${resolvePolarApiBase(options.apiBase)}/v1/customer-portal/license-keys/validate`

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ key, organization_id: organizationId })
    })

    const text = await response.text().catch(() => '')
    let payload: PolarLicencePayload | null = null
    if (text) {
      try {
        payload = JSON.parse(text) as PolarLicencePayload
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      const status = response.status
      const error = status === 404
        ? 'Invalid or unknown licence key'
        : `Polar validate failed (${status})`
      return { valid: false, status: String(payload?.status || ''), expiresAt: null, error, payload }
    }

    if (!isPolarLicenceGranted(payload)) {
      return {
        valid: false,
        status: String(payload?.status || ''),
        expiresAt: payload?.expires_at ?? null,
        error: payload?.expires_at && Date.parse(payload.expires_at) < Date.now()
          ? 'Licence key has expired'
          : 'Licence is not active (cancelled or revoked)',
        payload
      }
    }

    return {
      valid: true,
      status: 'granted',
      expiresAt: payload?.expires_at ?? null,
      error: null,
      payload
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Polar licence network error'
    return { valid: false, status: '', expiresAt: null, error: message, payload: null }
  }
}

export function hintLicenceKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return trimmed ? '••••' : ''
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}
