import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref } from 'vue'

const mockGetFullList = vi.fn()
const mockGetList = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockRequestPasswordReset = vi.fn()
const mockRequireUser = vi.fn(() => ({
  id: 'admin-1',
  role: 'admin',
  organization: 'org-1',
  is_billing_contact: true
}))

let useTeamMembers: typeof import('~/composables/useTeamMembers').useTeamMembers

beforeAll(async () => {
  vi.stubGlobal('useTenantOrg', () => ({
    isTenantHost: ref(false),
    organization: ref({ id: 'org-1', plan: 'team' })
  }))

  vi.stubGlobal('useOnboarding', () => ({
    onboardingState: ref({ teammateInvited: false, scheduleEnabled: false }),
    markTeammateInvited: vi.fn().mockResolvedValue(null),
    markScheduleEnabled: vi.fn().mockResolvedValue(null)
  }))

  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ ok: true }))

  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      authStore: { token: 'test-token', isValid: true },
      collection: (name: string) => {
        if (name === 'team_activity_log') {
          return { getList: mockGetList }
        }
        return {
          getFullList: mockGetFullList,
          create: mockCreate,
          update: mockUpdate,
          delete: mockDelete,
          requestPasswordReset: mockRequestPasswordReset
        }
      }
    },
    requireUser: mockRequireUser,
    awaitAuthReady: vi.fn().mockResolvedValue(undefined),
    syncAuth: vi.fn()
  }))

  const mod = await import('~/composables/useTeamMembers')
  useTeamMembers = mod.useTeamMembers
})

describe('useTeamMembers', () => {
  beforeEach(() => {
    mockGetFullList.mockReset()
    mockGetList.mockReset()
    mockCreate.mockReset()
    mockUpdate.mockReset()
    mockDelete.mockReset()
    mockRequestPasswordReset.mockReset()
    mockRequestPasswordReset.mockResolvedValue(true)
    mockRequireUser.mockReset()
    mockRequireUser.mockReturnValue({
      id: 'admin-1',
      role: 'admin',
      organization: 'org-1',
      is_billing_contact: true
    })
  })

  it('loads organization members', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'u1',
        name: 'Ada',
        email: 'ada@test',
        role: 'admin',
        is_billing_contact: true,
        verified: true,
        created: '2026-01-01'
      }
    ])

    const { members, fetchMembers } = useTeamMembers()
    await fetchMembers()

    expect(members.value).toHaveLength(1)
    expect(members.value[0]?.is_billing_contact).toBe(true)
    expect(mockGetFullList).toHaveBeenCalledWith({ sort: 'name' })
  })

  it('creates a member scoped to the admin organization and sends set-password email', async () => {
    mockCreate.mockResolvedValue({
      id: 'u2',
      name: 'Bob',
      email: 'bob@test',
      role: 'viewer',
      is_billing_contact: false,
      verified: false,
      created: '2026-01-02'
    })

    const { createMember } = useTeamMembers()
    const member = await createMember({
      name: 'Bob',
      email: 'bob@test',
      role: 'viewer'
    })

    expect(member.email).toBe('bob@test')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'bob@test',
      organization: 'org-1',
      role: 'viewer',
      is_billing_contact: false,
      passwordConfirm: expect.any(String)
    }))
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('bob@test')
  })

  it('rolls back the user when the invite email fails', async () => {
    mockCreate.mockResolvedValue({
      id: 'u-fail',
      name: 'Fail',
      email: 'fail@test',
      role: 'viewer',
      is_billing_contact: false,
      created: ''
    })
    mockDelete.mockResolvedValue(true)
    mockRequestPasswordReset.mockRejectedValue(new Error('SMTP not configured'))

    const { createMember } = useTeamMembers()
    await expect(createMember({
      name: 'Fail',
      email: 'fail@test',
      role: 'viewer'
    })).rejects.toThrow(/set-password email/)
    expect(mockDelete).toHaveBeenCalledWith('u-fail')
  })

  it('rejects create when the current user is not an org admin', async () => {
    mockRequireUser.mockReturnValue({ id: 'user-2', role: 'viewer', organization: 'org-1' })

    const { createMember } = useTeamMembers()
    await expect(createMember({
      name: 'Eve',
      email: 'eve@test',
      role: 'viewer'
    })).rejects.toThrow(/Only organization admins/)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('updates a member role when called by an org admin', async () => {
    mockUpdate.mockResolvedValue({
      id: 'u3',
      name: 'Chris',
      email: 'chris@test',
      role: 'viewer',
      is_billing_contact: false,
      created: '2026-01-03'
    })

    const { members, updateMemberRole } = useTeamMembers()
    members.value = [
      {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test',
        role: 'admin',
        is_billing_contact: true,
        verified: true,
        created: '2026-01-01'
      },
      {
        id: 'u3',
        name: 'Chris',
        email: 'chris@test',
        role: 'admin',
        is_billing_contact: false,
        verified: true,
        created: '2026-01-03'
      }
    ]

    const updated = await updateMemberRole('u3', 'viewer')
    expect(updated.role).toBe('viewer')
    expect(mockUpdate).toHaveBeenCalledWith('u3', { role: 'viewer', is_billing_contact: false })
  })

  it('rejects role updates for the current admin user', async () => {
    const { updateMemberRole } = useTeamMembers()
    await expect(updateMemberRole('admin-1', 'viewer')).rejects.toThrow(/cannot change your own role/)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('removes a member when called by an org admin', async () => {
    mockDelete.mockResolvedValue(true)

    const { members, removeMember } = useTeamMembers()
    members.value = [
      {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test',
        role: 'admin',
        is_billing_contact: true,
        verified: true,
        created: '2026-01-01'
      },
      {
        id: 'u4',
        name: 'Pat',
        email: 'pat@test',
        role: 'viewer',
        is_billing_contact: false,
        verified: true,
        created: '2026-01-04'
      }
    ]

    await removeMember('u4')
    expect(mockDelete).toHaveBeenCalledWith('u4')
    expect(members.value).toHaveLength(1)
  })

  it('rejects removing the last admin', async () => {
    const { members, removeMember } = useTeamMembers()
    members.value = [{
      id: 'admin-2',
      name: 'Only Admin',
      email: 'only-admin@test',
      role: 'admin',
      is_billing_contact: true,
      verified: true,
      created: '2026-01-05'
    }]

    await expect(removeMember('admin-2')).rejects.toThrow(/at least one Admin/)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('updates billing contact flag for an admin', async () => {
    mockUpdate.mockResolvedValue({
      id: 'admin-2',
      name: 'Second Admin',
      email: 'admin2@test',
      role: 'admin',
      is_billing_contact: true,
      verified: true,
      created: '2026-01-05'
    })

    const { members, updateMember } = useTeamMembers()
    members.value = [
      {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test',
        role: 'admin',
        is_billing_contact: true,
        verified: true,
        created: '2026-01-01'
      },
      {
        id: 'admin-2',
        name: 'Second Admin',
        email: 'admin2@test',
        role: 'admin',
        is_billing_contact: false,
        verified: true,
        created: '2026-01-05'
      }
    ]

    await updateMember('admin-2', { is_billing_contact: true })
    expect(mockUpdate).toHaveBeenCalledWith('admin-2', { is_billing_contact: true })
  })

  it('resends the set-password email and logs invite_resent activity', async () => {
    const { members, sendSetPasswordEmail } = useTeamMembers()
    members.value = [{
      id: 'u6',
      name: 'Quinn',
      email: 'quinn@test',
      role: 'viewer',
      is_billing_contact: false,
      verified: false,
      created: '2026-01-06'
    }]

    await sendSetPasswordEmail('u6')
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('quinn@test')
    expect($fetch).toHaveBeenCalledWith('/api/team-activity-log', expect.objectContaining({
      method: 'POST',
      body: { action: 'invite_resent', targetId: 'u6' }
    }))
  })

  it('fetches paginated team activity log entries', async () => {
    const { members, fetchActivityLog } = useTeamMembers()
    members.value = [
      {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@test',
        role: 'admin',
        is_billing_contact: true,
        verified: true,
        created: '2026-01-01'
      },
      {
        id: 'u1',
        name: 'New User',
        email: 'new@test',
        role: 'viewer',
        is_billing_contact: false,
        verified: false,
        created: '2026-01-02'
      }
    ]

    vi.mocked($fetch).mockResolvedValueOnce({
      page: 1,
      perPage: 20,
      totalItems: 1,
      totalPages: 1,
      items: [{
        id: 'log-1',
        action: 'member_added',
        created: '2026-06-12 10:00:00.000Z',
        details: { role: 'viewer' },
        actor: 'admin-1',
        target: 'u1'
      }]
    })

    const result = await fetchActivityLog({ page: 1, perPage: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.action).toBe('member_added')
    expect(result.items[0]?.actor?.name).toBe('Admin')
    expect(result.items[0]?.target?.email).toBe('new@test')
    expect($fetch).toHaveBeenCalledWith('/api/team-activity-log', expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
      query: { page: 1, perPage: 20 }
    }))
  })
})
