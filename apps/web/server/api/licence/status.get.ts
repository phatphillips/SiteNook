import { getPbAdmin } from '../../utils/pbAdmin'
import {
  buildCommunityApplianceStatus,
  buildLicensedApplianceStatus,
  isApplianceDeploymentMode
} from '../../utils/applianceLicenceStatus'
import { DEFAULT_POLAR_API_BASE, hintLicenceKey, validatePolarLicenseKey } from '../../utils/polarLicence'
import { normalizeLicenceTier } from '~/utils/licenceTiers'
import type { ApplianceLicenceStatusDto } from '~/types/applianceLicence'

async function resolveStoredLicenceKey(event: Parameters<typeof getPbAdmin>[0]): Promise<string> {
  const fromEnv = String(process.env.SITENOOK_LICENCE_KEY || process.env.ACCESSIQ_LICENCE_KEY || '').trim()
  if (fromEnv) return fromEnv
  try {
    const pb = await getPbAdmin(event)
    const orgs = await pb.collection('organizations').getFullList({ fields: 'licence_key' })
    for (const org of orgs) {
      const key = String((org as { licence_key?: string }).licence_key || '').trim()
      if (key) return key
    }
  } catch {
    // PocketBase admin or field may be unavailable
  }
  return ''
}

function polarOrganizationId(event: Parameters<typeof getPbAdmin>[0]): string {
  const config = useRuntimeConfig(event)
  return String(
    config.public.polarOrganizationId
    || process.env.SITENOOK_POLAR_ORGANIZATION_ID
    || process.env.NUXT_PUBLIC_POLAR_ORGANIZATION_ID
    || ''
  ).trim()
}

/**
 * Appliance dashboard status. Prefers Polar; falls back to apex licence server.
 */
export default defineEventHandler(async (event): Promise<ApplianceLicenceStatusDto> => {
  const config = useRuntimeConfig(event)
  const mode = config.public.deploymentMode

  if (!isApplianceDeploymentMode(mode)) {
    return {
      mode: 'cloud',
      licenceValid: true,
      tier: 'enterprise',
      plan: 'cloud',
      maxSites: null,
      maxPagesPerScan: null,
      upgradeRequired: false,
      message: 'Hosted cloud deployment',
      keyConfigured: false,
      keyHint: '',
      polarConfigured: false,
      checkoutUrl: String(config.public.polarCheckoutUrl || '')
    }
  }

  const key = await resolveStoredLicenceKey(event)
  const orgId = polarOrganizationId(event)
  const apiBase = String(config.public.polarApiUrl || process.env.SITENOOK_POLAR_API_URL || DEFAULT_POLAR_API_BASE)
  const checkoutUrl = String(config.public.polarCheckoutUrl || '')
  const extras = {
    keyConfigured: Boolean(key),
    keyHint: hintLicenceKey(key),
    polarConfigured: Boolean(orgId),
    checkoutUrl
  }

  if (!key) {
    return { ...buildCommunityApplianceStatus(), ...extras }
  }

  if (orgId) {
    const polar = await validatePolarLicenseKey({
      key,
      organizationId: orgId,
      apiBase
    })
    if (polar.valid) {
      return { ...buildLicensedApplianceStatus('selfhost'), ...extras }
    }
    return {
      ...buildCommunityApplianceStatus(polar.error || 'Polar licence invalid'),
      ...extras
    }
  }

  const serverUrl = String(
    process.env.SITENOOK_LICENCE_SERVER_URL || process.env.ACCESSIQ_LICENCE_SERVER_URL || ''
  ).replace(/\/$/, '')

  if (!serverUrl) {
    return {
      ...buildCommunityApplianceStatus(
        'Polar organization ID is not set on this install. Add SITENOOK_POLAR_ORGANIZATION_ID to .env (from Polar → Settings).'
      ),
      ...extras
    }
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
      return {
        ...buildCommunityApplianceStatus(`Licence validate failed (${response.status})`),
        ...extras
      }
    }

    const payload = await response.json() as { valid?: boolean, tier?: string }
    if (!payload.valid) {
      return { ...buildCommunityApplianceStatus('Licence rejected'), ...extras }
    }

    return { ...buildLicensedApplianceStatus(normalizeLicenceTier(payload.tier)), ...extras }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Licence server unreachable'
    return { ...buildCommunityApplianceStatus(message), ...extras }
  }
})
