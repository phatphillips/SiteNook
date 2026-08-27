export type OrganizationStatus = 'active' | 'closing'

export type TenantOrgOnboardingState = {
  dismissed?: boolean
  siteAdded?: boolean
  firstScanStarted?: boolean
  ahaSeen?: boolean
  teammateInvited?: boolean
  scheduleEnabled?: boolean
}

export type TenantOrgPublic = {
  id: string
  name: string
  subdomain: string
  plan?: string
  status?: OrganizationStatus
  subscription_status?: string
  trial_ends_at?: string
  purge_scheduled_at?: string
  onboarding_state?: TenantOrgOnboardingState | null
}

export type TenantContext = {
  mode: 'apex' | 'tenant' | 'unknown'
  subdomain: string | null
  organization: TenantOrgPublic | null
}
