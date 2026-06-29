import type { RecordModel } from 'pocketbase'

export type SiteAccessRole = 'owner' | 'editor' | 'viewer'

export type OrganizationPlan = 'free' | 'starter' | 'team' | 'business' | 'enterprise'

/** Org-level role on the PocketBase `users` collection (not per-site `site_access`). */
export type OrgUserRole = 'admin' | 'viewer'

export interface OrgMemberLike {
  id: string
  role: string
  is_billing_contact?: boolean
}

const ORG_USER_ROLE_LABELS: Record<OrgUserRole, string> = {
  admin: 'Admin',
  viewer: 'Viewer'
}

const LEGACY_ORG_USER_ROLE_LABELS: Record<string, string> = {
  owner: 'Admin',
  analyst: 'Viewer'
}

export function formatOrgUserRole(role: string | null | undefined): string {
  if (role && role in ORG_USER_ROLE_LABELS) {
    return ORG_USER_ROLE_LABELS[role as OrgUserRole]
  }
  if (role && role in LEGACY_ORG_USER_ROLE_LABELS) {
    return LEGACY_ORG_USER_ROLE_LABELS[role]
  }
  return role?.trim() || '—'
}

export function isBillingContact(user: RecordModel | OrgMemberLike | null | undefined): boolean {
  return Boolean(user?.is_billing_contact)
}

export function isOrgAdmin(user: RecordModel | null | undefined): boolean {
  return user?.role === 'admin'
}

/** Whether the user may create/edit/delete org resources (sites, scans, policies, etc.). */
export function canWriteOrg(user: RecordModel | null | undefined): boolean {
  return isOrgAdmin(user)
}

function countAdmins(users: OrgMemberLike[]): number {
  return users.filter(user => user.role === 'admin').length
}

function countBillingContacts(users: OrgMemberLike[]): number {
  return users.filter(user => Boolean(user.is_billing_contact)).length
}

export interface OrgAccessDecision {
  allowed: boolean
  reason?: string
}

export function canChangeRole(
  targetUser: OrgMemberLike,
  allOrgUsers: OrgMemberLike[],
  newRole: string,
  actor?: { id: string, role: string }
): OrgAccessDecision {
  if (actor && actor.id === targetUser.id) {
    return { allowed: false, reason: 'You cannot change your own role.' }
  }

  if (newRole === targetUser.role) {
    return { allowed: true }
  }

  if (targetUser.role === 'admin' && newRole !== 'admin') {
    if (countAdmins(allOrgUsers) <= 1) {
      return {
        allowed: false,
        reason: 'This is the last Admin — promote another member before changing this role.'
      }
    }

    if (targetUser.is_billing_contact && countBillingContacts(allOrgUsers) <= 1) {
      return {
        allowed: false,
        reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
      }
    }
  }

  return { allowed: true }
}

export function canRemoveMember(
  targetUser: OrgMemberLike,
  allOrgUsers: OrgMemberLike[],
  actor?: { id: string, role: string }
): OrgAccessDecision {
  if (actor && actor.id === targetUser.id) {
    return { allowed: false, reason: 'You cannot remove your own account.' }
  }

  if (targetUser.role === 'admin' && countAdmins(allOrgUsers) <= 1) {
    return {
      allowed: false,
      reason: 'Organization must have at least one Admin.'
    }
  }

  if (targetUser.is_billing_contact && countBillingContacts(allOrgUsers) <= 1) {
    return {
      allowed: false,
      reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
    }
  }

  return { allowed: true }
}

export function canToggleBillingContact(
  targetUser: OrgMemberLike,
  allOrgUsers: OrgMemberLike[],
  turningOff: boolean,
  selectedRole: string = targetUser.role
): OrgAccessDecision {
  if (selectedRole !== 'admin') {
    return { allowed: false, reason: 'Only admins can be billing contacts.' }
  }

  if (turningOff && targetUser.is_billing_contact && countBillingContacts(allOrgUsers) <= 1) {
    return {
      allowed: false,
      reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
    }
  }

  return { allowed: true }
}

/** Read organization id from a PocketBase user auth record. */
export function getUserOrganizationId(user: RecordModel | null | undefined): string | null {
  if (!user) return null
  const organization = user.organization
  if (typeof organization === 'string' && organization.trim()) {
    return organization.trim()
  }
  if (organization && typeof organization === 'object' && 'id' in organization) {
    const id = String((organization as { id: unknown }).id ?? '').trim()
    return id || null
  }
  return null
}

export function requireUserOrganizationId(user: RecordModel | null | undefined): string {
  const organizationId = getUserOrganizationId(user)
  if (!organizationId) {
    throw new Error('Your account is not assigned to an organization. Contact an administrator.')
  }
  return organizationId
}
