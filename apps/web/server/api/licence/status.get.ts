import {
  buildCommunityApplianceStatus,
  buildLicensedApplianceStatus,
  isApplianceDeploymentMode
} from '../../utils/applianceLicenceStatus'
import { normalizeLicenceTier } from '~/utils/licenceTiers'

/**
 * Appliance dashboard status. Validates against apex when a key is configured;
 * otherwise reports Community Free caps.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const mode = config.public.deploymentMode

  if (!isApplianceDeploymentMode(mode)) {
    return {
      mode: 'cloud' as const,
      licenceValid: true,
      tier: 'enterprise',
      plan: 'cloud',
      maxSites: null,
      maxPagesPerScan: null,
      upgradeRequired: false,
      message: 'Hosted cloud deployment'
    }
  }

  const key = String(process.env.SITENOOK_LICENCE_KEY || process.env.ACCESSIQ_LICENCE_KEY || '').trim()
  const serverUrl = String(process.env.SITENOOK_LICENCE_SERVER_URL || process.env.ACCESSIQ_LICENCE_SERVER_URL || '').replace(/\/$/, '')
  const cached = String(process.env.SITENOOK_LICENCE_CACHED_TOKEN || process.env.ACCESSIQ_LICENCE_CACHED_TOKEN || '').trim()

  if (cached) {
    try {
      const { verifyLicenceToken } = await import('../../utils/licenceTokens')
      const payload = verifyLicenceToken(cached, event)
      return buildLicensedApplianceStatus(payload.tier)
    } catch {
      // fall through to live validate
    }
  }

  if (!key || !serverUrl) {
    return buildCommunityApplianceStatus(
      key
        ? 'SITENOOK_LICENCE_SERVER_URL is not set — running Community Free caps.'
        : undefined
    )
  }

  const domain = String(process.env.SITENOOK_INSTANCE_DOMAIN || process.env.ACCESSIQ_INSTANCE_DOMAIN || 'localhost').toLowerCase()
  const fingerprintRaw = String(process.env.SITENOOK_INSTANCE_FINGERPRINT || process.env.ACCESSIQ_INSTANCE_FINGERPRINT || domain)

  try {
    const response = await fetch(`${serverUrl}/api/licence/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        domain,
        instance_fingerprint: fingerprintRaw
      })
    })

    if (!response.ok) {
      return buildCommunityApplianceStatus(`Licence validate failed (${response.status})`)
    }

    const payload = await response.json() as {
      valid?: boolean
      tier?: string
    }

    if (!payload.valid) {
      return buildCommunityApplianceStatus('Licence rejected')
    }

    return buildLicensedApplianceStatus(normalizeLicenceTier(payload.tier))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Licence server unreachable'
    return buildCommunityApplianceStatus(message)
  }
})
