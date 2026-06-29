import { createSharedComposable } from '@vueuse/core'
import type { RecordModel } from 'pocketbase'
import {
  canChangeRole,
  canRemoveMember,
  canToggleBillingContact,
  isOrgAdmin,
  requireUserOrganizationId,
  type OrgUserRole
} from '~/utils/orgAccess'
import {
  describePlanLimitExceeded,
  getPlanLimits,
  normalizeOrganizationPlan
} from '~/utils/planLimits'
import type { TeamActivityLogEntry } from '~/utils/teamActivityLog'
import { generateInvitePassword } from '~/utils/inviteUser'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: OrgUserRole | string
  is_billing_contact: boolean
  verified: boolean
  created: string
}

export interface UpdateTeamMemberInput {
  name?: string
  email?: string
  role?: OrgUserRole
  is_billing_contact?: boolean
}

export interface CreateTeamMemberInput {
  name: string
  email: string
  role: OrgUserRole
  is_billing_contact?: boolean
}

function toTeamMember(record: RecordModel): TeamMember {
  return {
    id: record.id,
    name: String(record.name ?? '').trim() || '—',
    email: String(record.email ?? '').trim(),
    role: String(record.role ?? 'viewer'),
    is_billing_contact: Boolean(record.is_billing_contact),
    verified: Boolean(record.verified),
    created: String(record.created ?? '')
  }
}

function _useTeamMembers() {
  const { pb, requireUser, awaitAuthReady, syncAuth } = usePocketBase()
  const { organization: tenantOrganization, isTenantHost } = useTenantOrg()
  const members = ref<TeamMember[]>([])
  const loading = ref(false)

  async function fetchMembers() {
    await awaitAuthReady()
    syncAuth()
    requireUser()
    loading.value = true
    try {
      const fetched = await pb.collection('users').getFullList({ sort: 'name' }) as RecordModel[]
      members.value = fetched.map(toTeamMember)
    } finally {
      loading.value = false
    }
  }

  async function createMember(input: CreateTeamMemberInput): Promise<TeamMember> {
    const currentUser = requireUser()
    if (!isOrgAdmin(currentUser)) {
      throw new Error('Only organization admins can add team members.')
    }

    const plan = normalizeOrganizationPlan(tenantOrganization.value?.plan)
    const limits = getPlanLimits(plan)
    if (members.value.length >= limits.maxTeamMembers) {
      throw new Error(describePlanLimitExceeded('teamMembers', plan))
    }

    const userOrgId = requireUserOrganizationId(currentUser)

    if (isTenantHost.value) {
      const tenantId = tenantOrganization.value?.id
      if (!tenantId) {
        throw new Error('Organization context is not available on this host.')
      }
      if (userOrgId !== tenantId) {
        throw new Error(
          'Your account belongs to a different organization. Sign out and sign in again using an account for this site.'
        )
      }
    }

    const organizationId = userOrgId
    const name = input.name.trim()
    const email = input.email.trim()

    if (!name || !email) {
      throw new Error('Name and email are required.')
    }

    const tempPassword = generateInvitePassword()
    const record = await pb.collection('users').create({
      name,
      email,
      password: tempPassword,
      passwordConfirm: tempPassword,
      role: input.role,
      is_billing_contact: input.role === 'admin' ? Boolean(input.is_billing_contact) : false,
      organization: organizationId,
      emailVisibility: true
    }) as RecordModel

    try {
      await pb.collection('users').requestPasswordReset(email)
    } catch {
      await pb.collection('users').delete(record.id).catch(() => {})
      throw new Error('Account was created but the set-password email could not be sent. Check SMTP settings and try again.')
    }

    const member = toTeamMember(record)
    members.value = [...members.value, member].sort((a, b) => a.name.localeCompare(b.name))
    return member
  }

  async function updateMember(memberId: string, input: UpdateTeamMemberInput): Promise<TeamMember> {
    const currentUser = requireUser()
    const isSelf = currentUser.id === memberId
    const existing = members.value.find(member => member.id === memberId)

    if (!existing) {
      throw new Error('Team member not found.')
    }

    if (input.role !== undefined && isSelf) {
      if (input.role !== existing.role) {
        throw new Error('You cannot change your own role.')
      }
    }

    const payload: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) throw new Error('Name is required.')
      if (name !== existing.name) payload.name = name
    }
    if (input.email !== undefined) {
      const email = input.email.trim()
      if (!email) throw new Error('Email is required.')
      if (email !== existing.email) payload.email = email
    }

    const nextRole = input.role ?? existing.role
    if (input.role !== undefined && input.role !== existing.role) {
      if (!isOrgAdmin(currentUser)) {
        throw new Error('Only organization admins can change team member roles.')
      }
      const decision = canChangeRole(existing, members.value, input.role, currentUser)
      if (!decision.allowed) {
        throw new Error(decision.reason || 'You do not have permission to change this team member\'s role.')
      }
      payload.role = input.role
    }

    if (input.is_billing_contact !== undefined && input.is_billing_contact !== existing.is_billing_contact) {
      if (!isOrgAdmin(currentUser)) {
        throw new Error('Only organization admins can change billing contact settings.')
      }
      const decision = canToggleBillingContact(
        existing,
        members.value,
        !input.is_billing_contact,
        nextRole
      )
      if (!decision.allowed) {
        throw new Error(decision.reason || 'You cannot change billing contact settings for this member.')
      }
      payload.is_billing_contact = nextRole === 'admin' ? input.is_billing_contact : false
    } else if (payload.role === 'viewer') {
      payload.is_billing_contact = false
    }

    if (Object.keys(payload).length === 0) {
      return existing
    }

    if (!isOrgAdmin(currentUser) && !isSelf) {
      throw new Error('You do not have permission to update this team member.')
    }

    const record = await pb.collection('users').update(memberId, payload) as RecordModel
    const member = toTeamMember(record)
    members.value = members.value
      .map(existingMember => existingMember.id === memberId ? member : existingMember)
      .sort((a, b) => a.name.localeCompare(b.name))
    return member
  }

  async function updateMemberRole(memberId: string, role: OrgUserRole): Promise<TeamMember> {
    return updateMember(memberId, { role })
  }

  async function logInviteResent(targetId: string): Promise<void> {
    const token = usePocketBase().pb.authStore.token
    if (!token) return

    await $fetch('/api/team-activity-log', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        action: 'invite_resent',
        targetId
      }
    })
  }

  async function sendSetPasswordEmail(memberId: string): Promise<void> {
    const currentUser = requireUser()
    if (!isOrgAdmin(currentUser)) {
      throw new Error('Only organization admins can send password emails.')
    }
    if (currentUser.id === memberId) {
      throw new Error('Use account settings to change your own password.')
    }

    const member = members.value.find(existing => existing.id === memberId)
    if (!member) {
      throw new Error('Team member not found.')
    }

    await pb.collection('users').requestPasswordReset(member.email)
    await logInviteResent(memberId).catch(() => {})
  }

  async function removeMembers(memberIds: string[]): Promise<number> {
    const uniqueIds = [...new Set(memberIds)]
    let removed = 0
    for (const memberId of uniqueIds) {
      await removeMember(memberId)
      removed += 1
    }
    return removed
  }

  async function removeMember(memberId: string): Promise<void> {
    const currentUser = requireUser()
    const member = members.value.find(existing => existing.id === memberId)
    if (!member) {
      throw new Error('Team member not found.')
    }

    if (!isOrgAdmin(currentUser)) {
      throw new Error('Only organization admins can remove team members.')
    }

    const decision = canRemoveMember(member, members.value, currentUser)
    if (!decision.allowed) {
      throw new Error(decision.reason || 'You cannot remove this team member.')
    }

    await pb.collection('users').delete(memberId)
    members.value = members.value.filter(existing => existing.id !== memberId)
  }

  async function fetchActivityLog(options: { page?: number, perPage?: number } = {}): Promise<{
    items: TeamActivityLogEntry[]
    page: number
    perPage: number
    totalItems: number
    totalPages: number
  }> {
    await awaitAuthReady()
    syncAuth()
    requireUser()

    const page = options.page ?? 1
    const perPage = options.perPage ?? 20
    const token = pb.authStore.token
    if (!token) {
      throw new Error('Session expired. Sign in again.')
    }

    const memberById = new Map(members.value.map(member => [member.id, member]))

    const result = await $fetch<{
      page: number
      perPage: number
      totalItems: number
      totalPages: number
      items: Array<{
        id: string
        action: string
        created: string
        details?: Record<string, unknown> | null
        actor?: string | null
        target?: string | null
      }>
    }>('/api/team-activity-log', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      query: {
        page,
        perPage
      }
    })

    const resolveActivityUser = (userId: unknown) => {
      if (userId == null || userId === '') return null
      const id = String(userId)
      const member = memberById.get(id)
      if (member) {
        return { id, name: member.name, email: member.email }
      }
      return { id, name: 'Former member' }
    }

    const items = result.items.map((record) => {
      return {
        id: record.id,
        action: String(record.action ?? ''),
        created: String(record.created ?? ''),
        details: (record.details as Record<string, unknown> | null | undefined) ?? null,
        actor: resolveActivityUser(record.actor),
        target: resolveActivityUser(record.target)
      } satisfies TeamActivityLogEntry
    })

    return {
      items,
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages
    }
  }

  function resetSession() {
    members.value = []
    loading.value = false
  }

  return {
    members,
    loading,
    resetSession,
    fetchMembers,
    createMember,
    updateMember,
    updateMemberRole,
    sendSetPasswordEmail,
    removeMember,
    removeMembers,
    fetchActivityLog
  }
}

export const useTeamMembers = createSharedComposable(_useTeamMembers)
