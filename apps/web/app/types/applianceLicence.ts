export type ApplianceLicenceStatusDto = {
  mode: 'cloud' | 'appliance'
  licenceValid: boolean
  tier: string
  plan: string
  maxSites: number | null
  maxPagesPerScan: number | null
  upgradeRequired: boolean
  message: string
}
