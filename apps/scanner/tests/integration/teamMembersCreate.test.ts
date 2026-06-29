import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import PocketBase, { ClientResponseError } from 'pocketbase'

const PB_URL = process.env.PB_TEST_URL || 'http://localhost:8091'
const ADMIN_EMAIL = process.env.PB_TEST_USER_EMAIL || 'test-user@accessiq.test'
const ADMIN_PASSWORD = process.env.PB_TEST_USER_PASSWORD || 'test-user-password-123'

describe('team member create rules (integration)', () => {
  const adminPb = new PocketBase(PB_URL)
  const viewerPb = new PocketBase(PB_URL)

  let organizationId: string
  let createdUserId: string | undefined
  let viewerUserId: string | undefined
  const createdEmail = `team-create-${Date.now()}@accessiq.test`
  const viewerEmail = `team-viewer-${Date.now()}@accessiq.test`

  beforeAll(async () => {
    const superPb = new PocketBase(PB_URL)
    await superPb.collection('_superusers').authWithPassword(
      process.env.PB_TEST_ADMIN_EMAIL || 'test-admin@accessiq.test',
      process.env.PB_TEST_ADMIN_PASSWORD || 'test-password-123'
    )

    const existingAdmin = await superPb.collection('users').getFullList({
      filter: `email = "${ADMIN_EMAIL}"`,
      limit: 1
    })
    if (existingAdmin.length) {
      await superPb.collection('users').update(existingAdmin[0].id, {
        role: 'admin',
        is_billing_contact: true,
        verified: true
      })
    }

    await adminPb.collection('users').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
    organizationId = adminPb.authStore.record?.organization as string
    if (!organizationId) {
      throw new Error('Test admin user has no organization')
    }
    if (adminPb.authStore.record?.role !== 'admin') {
      throw new Error('Test user must have org role admin — check seed.sh / patch-users.sh')
    }

    const viewer = await superPb.collection('users').create({
      email: viewerEmail,
      password: 'viewer-password-123',
      passwordConfirm: 'viewer-password-123',
      name: 'Viewer Create Test',
      role: 'viewer',
      organization: organizationId,
      emailVisibility: true,
      verified: true
    })
    viewerUserId = viewer.id
    await viewerPb.collection('users').authWithPassword(viewerEmail, 'viewer-password-123')
    superPb.authStore.clear()
  })

  afterAll(async () => {
    const superPb = new PocketBase(PB_URL)
    try {
      await superPb.collection('_superusers').authWithPassword(
        process.env.PB_TEST_ADMIN_EMAIL || 'test-admin@accessiq.test',
        process.env.PB_TEST_ADMIN_PASSWORD || 'test-password-123'
      )
      if (createdUserId) {
        await superPb.collection('users').delete(createdUserId)
      }
      if (viewerUserId) {
        await superPb.collection('users').delete(viewerUserId)
      }
    } catch {
      // already removed
    }
    adminPb.authStore.clear()
    viewerPb.authStore.clear()
  })

  it('allows an org admin to create a user in the same organization', async () => {
    const created = await adminPb.collection('users').create({
      email: createdEmail,
      password: 'new-member-password',
      passwordConfirm: 'new-member-password',
      name: 'Created Member',
      role: 'viewer',
      organization: organizationId,
      emailVisibility: true
    })
    createdUserId = created.id
    expect(created.organization).toBe(organizationId)

    const loginPb = new PocketBase(PB_URL)
    const auth = await loginPb.collection('users').authWithPassword(createdEmail, 'new-member-password')
    expect(auth.record?.email).toBe(createdEmail)
    loginPb.authStore.clear()
  })

  it('allows creating admin and viewer roles only', async () => {
    const adminEmail = `team-admin-create-${Date.now()}@accessiq.test`
    const createdAdmin = await adminPb.collection('users').create({
      email: adminEmail,
      password: 'new-member-password',
      passwordConfirm: 'new-member-password',
      name: 'Created Admin',
      role: 'admin',
      organization: organizationId,
      emailVisibility: true
    })
    expect(createdAdmin.role).toBe('admin')

    const superPb = new PocketBase(PB_URL)
    await superPb.collection('_superusers').authWithPassword(
      process.env.PB_TEST_ADMIN_EMAIL || 'test-admin@accessiq.test',
      process.env.PB_TEST_ADMIN_PASSWORD || 'test-password-123'
    )
    await superPb.collection('users').delete(createdAdmin.id)
    superPb.authStore.clear()
  })

  it('rejects legacy owner and analyst roles on create', async () => {
    await expect(
      adminPb.collection('users').create({
        email: `team-owner-${Date.now()}@accessiq.test`,
        password: 'new-member-password',
        passwordConfirm: 'new-member-password',
        name: 'Blocked Owner',
        role: 'owner',
        organization: organizationId,
        emailVisibility: true
      })
    ).rejects.toSatisfy((error: unknown) =>
      error instanceof ClientResponseError && [400, 403].includes(error.status)
    )

    await expect(
      adminPb.collection('users').create({
        email: `team-analyst-${Date.now()}@accessiq.test`,
        password: 'new-member-password',
        passwordConfirm: 'new-member-password',
        name: 'Blocked Analyst',
        role: 'analyst',
        organization: organizationId,
        emailVisibility: true
      })
    ).rejects.toSatisfy((error: unknown) =>
      error instanceof ClientResponseError && [400, 403].includes(error.status)
    )
  })

  it('denies unauthenticated clients from creating users', async () => {
    const anonPb = new PocketBase(PB_URL)
    await expect(
      anonPb.collection('users').create({
        email: `anon-${Date.now()}@accessiq.test`,
        password: 'new-member-password',
        passwordConfirm: 'new-member-password',
        name: 'Anonymous Signup',
        role: 'viewer',
        organization: organizationId,
        emailVisibility: true
      })
    ).rejects.toSatisfy((error: unknown) =>
      error instanceof ClientResponseError && [400, 403].includes(error.status)
    )
  })

  it('denies a non-admin org user from creating users', async () => {
    await expect(
      viewerPb.collection('users').create({
        email: `blocked-${Date.now()}@accessiq.test`,
        password: 'new-member-password',
        passwordConfirm: 'new-member-password',
        name: 'Blocked Member',
        role: 'viewer',
        organization: organizationId,
        emailVisibility: true
      })
    ).rejects.toSatisfy((error: unknown) =>
      error instanceof ClientResponseError && [400, 403].includes(error.status)
    )
  })
})
