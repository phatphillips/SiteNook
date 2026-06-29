export type OrganizationStatus = 'active' | 'closing'

export type TenantOrgPublic = {
  id: string
  name: string
  subdomain: string
  plan?: string
  status?: OrganizationStatus
  subscription_status?: string
  purge_scheduled_at?: string
}

export type TenantContext = {
  mode: 'apex' | 'tenant' | 'unknown'
  subdomain: string | null
  organization: TenantOrgPublic | null
}
