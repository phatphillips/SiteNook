import { createHash } from 'node:crypto'
import {
  normalizeOrganizationPlan,
  type OrganizationPlan
} from '../config/planLimits.js'
import {
  getApplianceEffectivePlan,
  normalizeLicenceTier,
  type LicenceTier
} from '../config/licenceTiers.js'

export interface LicenceValidateResponse {
  valid: boolean
  tier: string
  plan?: string
  limits?: { maxPagesPerScan?: number }
  expires_at?: string
  signed_token?: string
}

export interface ApplianceLicenceState {
  mode: 'cloud' | 'appliance'
  licenceValid: boolean
  tier: LicenceTier
  plan: OrganizationPlan
  signedToken: string | null
  expiresAt: string | null
  lastError: string | null
}

function env(name: string, fallback = ''): string {
  const current = String(process.env[name] ?? '').trim()
  if (current) return current
  if (name.startsWith('SITENOOK_')) {
    const legacy = String(process.env[`ACCESSIQ_${name.slice('SITENOOK_'.length)}`] ?? '').trim()
    if (legacy) return legacy
  }
  return fallback
}

export function isApplianceDeploymentMode(
  value = process.env.SITENOOK_DEPLOYMENT_MODE ?? process.env.ACCESSIQ_DEPLOYMENT_MODE
): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'appliance' || normalized === 'selfhost' || normalized === 'community'
}

export function resolveInstanceFingerprint(): string {
  const explicit = env('SITENOOK_INSTANCE_FINGERPRINT')
  if (explicit) return explicit
  const domain = env('SITENOOK_INSTANCE_DOMAIN', env('HOSTNAME', 'local'))
  return createHash('sha256').update(`sitenook-appliance|${domain}`).digest('hex')
}

export function resolveInstanceDomain(): string {
  return env('SITENOOK_INSTANCE_DOMAIN', env('HOSTNAME', 'localhost')).toLowerCase()
}

function communityState(error: string | null = null): ApplianceLicenceState {
  return {
    mode: 'appliance',
    licenceValid: false,
    tier: 'community',
    plan: 'free',
    signedToken: null,
    expiresAt: null,
    lastError: error
  }
}

let cachedState: ApplianceLicenceState | null = null

export function getCachedApplianceLicenceState(): ApplianceLicenceState | null {
  return cachedState
}

export function setCachedApplianceLicenceState(state: ApplianceLicenceState): void {
  cachedState = state
}

export function clearCachedApplianceLicenceState(): void {
  cachedState = null
}

export function effectiveOrgPlanForScan(orgPlan: unknown): OrganizationPlan {
  if (!isApplianceDeploymentMode()) {
    return normalizeOrganizationPlan(orgPlan)
  }
  const state = cachedState
  if (!state) {
    return getApplianceEffectivePlan({ licenceValid: false })
  }
  return state.plan
}

export async function validateApplianceLicence(options?: {
  fetchImpl?: typeof fetch
  licenceKey?: string
  serverUrl?: string
}): Promise<ApplianceLicenceState> {
  if (!isApplianceDeploymentMode()) {
    const cloud: ApplianceLicenceState = {
      mode: 'cloud',
      licenceValid: true,
      tier: 'enterprise',
      plan: 'enterprise',
      signedToken: null,
      expiresAt: null,
      lastError: null
    }
    cachedState = cloud
    return cloud
  }

  const key = (options?.licenceKey ?? env('SITENOOK_LICENCE_KEY')).trim()
  const serverUrl = (options?.serverUrl ?? env('SITENOOK_LICENCE_SERVER_URL')).replace(/\/$/, '')
  if (!key || !serverUrl) {
    const state = communityState(
      key ? 'SITENOOK_LICENCE_SERVER_URL is not set' : 'No licence key — running Community Free caps'
    )
    cachedState = state
    return state
  }

  const fetchImpl = options?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(`${serverUrl}/api/licence/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        domain: resolveInstanceDomain(),
        instance_fingerprint: resolveInstanceFingerprint()
      })
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const state = communityState(`Licence validate failed (${response.status}): ${text}`)
      cachedState = state
      return state
    }

    const payload = await response.json() as LicenceValidateResponse
    if (!payload.valid || !payload.signed_token) {
      const state = communityState('Licence validate returned invalid payload')
      cachedState = state
      return state
    }

    const tier = normalizeLicenceTier(payload.tier)
    const state: ApplianceLicenceState = {
      mode: 'appliance',
      licenceValid: true,
      tier,
      plan: getApplianceEffectivePlan({ licenceValid: true, tier }),
      signedToken: payload.signed_token,
      expiresAt: payload.expires_at ?? null,
      lastError: null
    }
    cachedState = state
    return state
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Licence validate network error'
    // Offline: keep previous paid token if still cached
    if (cachedState?.licenceValid && cachedState.signedToken) {
      cachedState = { ...cachedState, lastError: message }
      return cachedState
    }
    const state = communityState(message)
    cachedState = state
    return state
  }
}

export async function heartbeatApplianceLicence(options?: {
  fetchImpl?: typeof fetch
  serverUrl?: string
}): Promise<ApplianceLicenceState> {
  if (!isApplianceDeploymentMode()) {
    return validateApplianceLicence(options)
  }

  const token = cachedState?.signedToken
  const serverUrl = (options?.serverUrl ?? env('SITENOOK_LICENCE_SERVER_URL')).replace(/\/$/, '')
  if (!token || !serverUrl) {
    return validateApplianceLicence(options)
  }

  const fetchImpl = options?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(`${serverUrl}/api/licence/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed_token: token })
    })
    if (!response.ok) {
      return validateApplianceLicence(options)
    }
    const payload = await response.json() as LicenceValidateResponse
    if (!payload.valid || !payload.signed_token) {
      return validateApplianceLicence(options)
    }
    const tier = normalizeLicenceTier(payload.tier)
    const state: ApplianceLicenceState = {
      mode: 'appliance',
      licenceValid: true,
      tier,
      plan: getApplianceEffectivePlan({ licenceValid: true, tier }),
      signedToken: payload.signed_token,
      expiresAt: payload.expires_at ?? null,
      lastError: null
    }
    cachedState = state
    return state
  } catch {
    if (cachedState?.licenceValid) return cachedState
    return communityState('Heartbeat failed')
  }
}

export async function syncApplianceOrgPlans(
  pb: { collection: (name: string) => {
    getFullList: (opts?: object) => Promise<Array<{ id: string, plan?: string }>>
    update: (id: string, data: object) => Promise<unknown>
  } },
  plan: OrganizationPlan
): Promise<number> {
  if (!isApplianceDeploymentMode()) return 0
  const orgs = await pb.collection('organizations').getFullList({ fields: 'id,plan' })
  let updated = 0
  for (const org of orgs) {
    if (String(org.plan || '') === plan) continue
    await pb.collection('organizations').update(org.id, { plan })
    updated += 1
  }
  return updated
}
