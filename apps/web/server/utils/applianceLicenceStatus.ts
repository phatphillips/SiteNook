import {
  getApplianceEffectiveLimits,
  isFullSelfHostTier,
  normalizeLicenceTier,
  type LicenceTier
} from '~/utils/licenceTiers'

export function isApplianceDeploymentMode(value?: unknown): boolean {
  const raw = value ?? process.env.SITENOOK_DEPLOYMENT_MODE ?? process.env.ACCESSIQ_DEPLOYMENT_MODE ?? ''
  const normalized = String(raw).trim().toLowerCase()
  return normalized === 'appliance' || normalized === 'selfhost' || normalized === 'community'
}

export interface ApplianceLicenceStatus {
  mode: 'cloud' | 'appliance'
  licenceValid: boolean
  tier: LicenceTier
  plan: string
  maxSites: number
  maxPagesPerScan: number
  upgradeRequired: boolean
  message: string
}

export function buildCommunityApplianceStatus(message?: string): ApplianceLicenceStatus {
  const limits = getApplianceEffectiveLimits({ licenceValid: false })
  return {
    mode: 'appliance',
    licenceValid: false,
    tier: 'community',
    plan: 'free',
    maxSites: limits.maxSites,
    maxPagesPerScan: limits.maxPagesPerScan,
    upgradeRequired: true,
    message: message
      || 'Running Community edition. Activate a Self-host licence to unlock full local limits.'
  }
}

export function buildLicensedApplianceStatus(tier: unknown): ApplianceLicenceStatus {
  const normalized = normalizeLicenceTier(tier)
  const limits = getApplianceEffectiveLimits({ licenceValid: true, tier: normalized })
  return {
    mode: 'appliance',
    licenceValid: true,
    tier: normalized,
    plan: normalized === 'enterprise' ? 'enterprise' : normalized === 'selfhost' ? 'business' : 'free',
    maxSites: limits.maxSites,
    maxPagesPerScan: limits.maxPagesPerScan,
    upgradeRequired: !isFullSelfHostTier(normalized),
    message: isFullSelfHostTier(normalized)
      ? `Licensed ${normalized}. Full self-host limits active.`
      : 'Community licence active. Free caps apply. Purchase Self-host to unlock.'
  }
}
