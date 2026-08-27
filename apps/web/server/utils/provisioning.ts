import { randomBytes } from 'node:crypto'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import type { OrganizationPlan } from '~/types/sitenook'
import { isOrganizationPlan } from '~/utils/planPricing'
import { normalizeOrganizationPlan } from '~/utils/planLimits'
import { RESERVED_SUBDOMAINS } from '~/utils/subdomain'
import { buildTeamTrialProvisionFields } from './teamTrial'

export type OrganizationCreatedVia = 'self_service' | 'provision_api'

export interface ProvisionOrganizationInput {
  orgName: string
  subdomain: string
  ownerName: string
  ownerEmail: string
  plan?: string
  /** When true with plan team, provision a 30-day app-managed Team trial. */
  teamTrial?: boolean
}

export interface ProvisionOrganizationOptions {
  appDomain: string
  appUrl: string
  createdVia?: OrganizationCreatedVia
}

export interface ProvisionOrganizationResult {
  organization: { id: string, name: string, subdomain: string, plan: OrganizationPlan }
  owner: { id: string, email: string, name: string }
  loginUrl: string
  inviteEmailSent: boolean
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOrgName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Organization name is required.'
  if (trimmed.length > 120) return 'Organization name must be 120 characters or fewer.'
  return null
}

export function validateSubdomain(subdomain: string): string | null {
  const slug = subdomain.trim().toLowerCase()
  if (slug.length < 2 || slug.length > 63) {
    return 'Subdomain must be 2–63 characters.'
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Subdomain may only contain lowercase letters, numbers, and hyphens.'
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return 'Subdomain cannot start or end with a hyphen.'
  }
  if (RESERVED_SUBDOMAINS.has(slug)) {
    return `Subdomain "${slug}" is reserved.`
  }
  return null
}

export function validateOwnerEmail(email: string): string | null {
  const trimmed = email.trim()
  if (!trimmed) return 'Owner email is required.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Owner email is not valid.'
  return null
}

export function validateOwnerName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Owner name is required.'
  if (trimmed.length > 120) return 'Owner name must be 120 characters or fewer.'
  return null
}

export function validateProvisionPlan(plan: string | undefined): string | null {
  if (!plan?.trim()) return null
  if (!isOrganizationPlan(plan.trim())) {
    return 'Plan must be free, starter, team, business, or enterprise.'
  }
  return null
}

export function validateProvisionInput(input: ProvisionOrganizationInput): string | null {
  return validateOrgName(input.orgName)
    || validateSubdomain(input.subdomain)
    || validateOwnerName(input.ownerName)
    || validateOwnerEmail(input.ownerEmail)
    || validateProvisionPlan(input.plan)
}

/** Random password for records that will receive a set-password email immediately. */
export function generateTemporaryPassword(): string {
  return `${randomBytes(24).toString('base64url')}Aa1!`
}

/** Build the tenant sign-in URL for a provisioned organization. */
export function buildTenantLoginUrl(subdomain: string, appDomain: string, appUrl: string): string {
  const slug = subdomain.trim().toLowerCase()
  const domain = appDomain.trim().toLowerCase()

  if (domain === 'localhost') {
    try {
      const base = new URL(appUrl)
      const port = base.port ? `:${base.port}` : ''
      return `${base.protocol}//${slug}.localhost${port}/login`
    } catch {
      return `http://${slug}.localhost:3000/login`
    }
  }

  const protocol = appUrl.startsWith('http://') ? 'http' : 'https'
  return `${protocol}://${slug}.${domain}/login`
}

/** Tenant dashboard origin (no path), e.g. http://acme.localhost:3000 */
export function buildTenantAppOrigin(subdomain: string, appDomain: string, appUrl: string): string {
  return buildTenantLoginUrl(subdomain, appDomain, appUrl).replace(/\/login\/?$/, '')
}

export async function sendSetPasswordEmail(pb: PocketBase, email: string): Promise<void> {
  await pb.collection('users').requestPasswordReset(email.trim())
}

export async function checkSubdomainAvailability(
  pb: PocketBase,
  subdomain: string
): Promise<{ available: boolean, reason?: string }> {
  const validationError = validateSubdomain(subdomain)
  if (validationError) {
    return { available: false, reason: validationError }
  }

  const slug = subdomain.trim().toLowerCase()
  try {
    await pb.collection('organizations').getFirstListItem(
      `subdomain = "${slug.replace(/"/g, '\\"')}"`,
      { fields: 'id' }
    )
    return { available: false, reason: `Subdomain "${slug}" is already in use.` }
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return { available: true }
    }
    throw error
  }
}

export function resolveProvisionPlan(
  input: ProvisionOrganizationInput,
  createdVia?: OrganizationCreatedVia
): OrganizationPlan {
  const trimmed = input.plan?.trim()
  if (trimmed) {
    if (!isOrganizationPlan(trimmed)) {
      throw new Error('Plan must be free, starter, team, business, or enterprise.')
    }
    return normalizeOrganizationPlan(trimmed)
  }
  return createdVia === 'self_service' ? 'free' : 'team'
}

export function formatPbError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const data = error.response as { message?: string, data?: Record<string, { message?: string }> } | undefined
    const fieldMessages = data?.data
      ? Object.values(data.data)
        .map(field => field?.message)
        .filter((message): message is string => Boolean(message))
      : []
    if (fieldMessages.length) {
      return fieldMessages.join(' ')
    }
    if (data?.message) {
      return data.message
    }
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Provisioning failed'
}

export async function provisionOrganization(
  pb: PocketBase,
  input: ProvisionOrganizationInput,
  options: ProvisionOrganizationOptions
): Promise<ProvisionOrganizationResult> {
  const validationError = validateProvisionInput(input)
  if (validationError) {
    throw new Error(validationError)
  }

  const subdomain = input.subdomain.trim().toLowerCase()
  const ownerEmail = input.ownerEmail.trim()
  const tempPassword = generateTemporaryPassword()

  const availability = await checkSubdomainAvailability(pb, subdomain)
  if (!availability.available) {
    throw new Error(availability.reason || `Subdomain "${subdomain}" is already in use.`)
  }

  const plan = resolveProvisionPlan(input, options.createdVia)

  const organizationPayload: Record<string, unknown> = {
    name: input.orgName.trim(),
    subdomain,
    plan,
    status: 'active',
    subscription_status: 'none'
  }
  if (options.createdVia) {
    organizationPayload.created_via = options.createdVia
  }
  if (input.teamTrial && plan === 'team') {
    Object.assign(organizationPayload, buildTeamTrialProvisionFields())
  } else {
    organizationPayload.onboarding_state = {
      dismissed: false,
      siteAdded: false,
      firstScanStarted: false,
      ahaSeen: false,
      teammateInvited: false,
      scheduleEnabled: false
    }
  }

  const organization = await pb.collection('organizations').create(organizationPayload)

  let owner
  try {
    owner = await pb.collection('users').create({
      name: input.ownerName.trim(),
      email: ownerEmail,
      password: tempPassword,
      passwordConfirm: tempPassword,
      role: 'admin',
      is_billing_contact: true,
      organization: organization.id,
      emailVisibility: true,
      verified: false
    })
  } catch (error) {
    await pb.collection('organizations').delete(organization.id).catch(() => {})
    const message = formatPbError(error)
    if (/email.*unique|already exists/i.test(message)) {
      throw new Error(`Owner email "${ownerEmail}" is already registered. Use a different email address.`)
    }
    throw new Error(message)
  }

  let inviteEmailSent = false
  try {
    await sendSetPasswordEmail(pb, ownerEmail)
    inviteEmailSent = true
  } catch {
    inviteEmailSent = false
  }

  return {
    organization: {
      id: organization.id,
      name: String(organization.name),
      subdomain: String(organization.subdomain),
      plan
    },
    owner: {
      id: owner.id,
      email: String(owner.email),
      name: String(owner.name)
    },
    loginUrl: buildTenantLoginUrl(subdomain, options.appDomain, options.appUrl),
    inviteEmailSent
  }
}
