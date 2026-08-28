import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  clearCachedApplianceLicenceState,
  effectiveOrgPlanForScan,
  isApplianceDeploymentMode,
  setCachedApplianceLicenceState,
  validateApplianceLicence
} from '../../../src/licence/applianceLicence.js'

describe('applianceLicence', () => {
  const prevMode = process.env.SITENOOK_DEPLOYMENT_MODE
  const prevKey = process.env.SITENOOK_LICENCE_KEY
  const prevServer = process.env.SITENOOK_LICENCE_SERVER_URL

  const prevPolar = process.env.SITENOOK_POLAR_ORGANIZATION_ID

  beforeEach(() => {
    clearCachedApplianceLicenceState()
    delete process.env.SITENOOK_DEPLOYMENT_MODE
    delete process.env.SITENOOK_LICENCE_KEY
    delete process.env.SITENOOK_LICENCE_SERVER_URL
    delete process.env.SITENOOK_POLAR_ORGANIZATION_ID
  })

  afterEach(() => {
    clearCachedApplianceLicenceState()
    if (prevMode === undefined) delete process.env.SITENOOK_DEPLOYMENT_MODE
    else process.env.SITENOOK_DEPLOYMENT_MODE = prevMode
    if (prevKey === undefined) delete process.env.SITENOOK_LICENCE_KEY
    else process.env.SITENOOK_LICENCE_KEY = prevKey
    if (prevServer === undefined) delete process.env.SITENOOK_LICENCE_SERVER_URL
    else process.env.SITENOOK_LICENCE_SERVER_URL = prevServer
    if (prevPolar === undefined) delete process.env.SITENOOK_POLAR_ORGANIZATION_ID
    else process.env.SITENOOK_POLAR_ORGANIZATION_ID = prevPolar
  })

  it('detects appliance mode', () => {
    expect(isApplianceDeploymentMode('cloud')).toBe(false)
    expect(isApplianceDeploymentMode('appliance')).toBe(true)
  })

  it('uses org plan in cloud mode', () => {
    expect(effectiveOrgPlanForScan('team')).toBe('team')
  })

  it('caps at free without licence in appliance mode', async () => {
    process.env.SITENOOK_DEPLOYMENT_MODE = 'appliance'
    const state = await validateApplianceLicence()
    expect(state.plan).toBe('free')
    expect(state.tier).toBe('community')
    expect(effectiveOrgPlanForScan('business')).toBe('free')
  })

  it('unlocks business plan after valid selfhost licence', async () => {
    process.env.SITENOOK_DEPLOYMENT_MODE = 'appliance'
    process.env.SITENOOK_LICENCE_KEY = 'lic_test'
    process.env.SITENOOK_LICENCE_SERVER_URL = 'https://licence.test'

    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        valid: true,
        tier: 'selfhost',
        plan: 'business',
        signed_token: 'token.sig',
        expires_at: '2027-01-01T00:00:00.000Z'
      }),
      text: async () => ''
    }) as unknown as typeof fetch

    const state = await validateApplianceLicence({ fetchImpl })
    expect(state.licenceValid).toBe(true)
    expect(state.plan).toBe('business')
    expect(getMaxPages(state.plan)).toBe(5_000)
  })

  it('unlocks business plan via Polar granted key', async () => {
    process.env.SITENOOK_DEPLOYMENT_MODE = 'appliance'
    process.env.SITENOOK_LICENCE_KEY = 'AIQ_test'
    process.env.SITENOOK_POLAR_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111'

    const fetchImpl = async () => ({
      ok: true,
      text: async () => JSON.stringify({
        status: 'granted',
        id: 'lk_1',
        expires_at: '2099-01-01T00:00:00.000Z'
      })
    }) as unknown as typeof fetch

    const state = await validateApplianceLicence({ fetchImpl })
    expect(state.licenceValid).toBe(true)
    expect(state.plan).toBe('business')
    expect(state.tier).toBe('selfhost')
  })

  it('keeps cached paid licence on network failure', async () => {
    process.env.SITENOOK_DEPLOYMENT_MODE = 'appliance'
    setCachedApplianceLicenceState({
      mode: 'appliance',
      licenceValid: true,
      tier: 'selfhost',
      plan: 'business',
      signedToken: 'cached.token',
      expiresAt: '2027-01-01T00:00:00.000Z',
      lastError: null
    })
    process.env.SITENOOK_LICENCE_KEY = 'lic_test'
    process.env.SITENOOK_LICENCE_SERVER_URL = 'https://licence.test'

    const fetchImpl = async () => {
      throw new Error('network down')
    }

    const state = await validateApplianceLicence({ fetchImpl })
    expect(state.licenceValid).toBe(true)
    expect(state.plan).toBe('business')
  })
})

function getMaxPages(plan: string): number {
  if (plan === 'business') return 5_000
  if (plan === 'free') return 20
  return 0
}
