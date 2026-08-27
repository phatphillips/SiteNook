import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import PocketBase, { ClientResponseError } from 'pocketbase'

const PB_URL = process.env.PB_TEST_URL || 'http://localhost:8091'
const ADMIN_EMAIL = process.env.PB_TEST_USER_EMAIL || 'test-user@sitenook.test'
const ADMIN_PASSWORD = process.env.PB_TEST_USER_PASSWORD || 'test-user-password-123'

function expectRejected(error: unknown) {
  return error instanceof ClientResponseError && [400, 403, 404].includes(error.status)
}

async function authSuperuser(pb: PocketBase) {
  await pb.collection('_superusers').authWithPassword(
    process.env.PB_TEST_ADMIN_EMAIL || 'test-admin@sitenook.test',
    process.env.PB_TEST_ADMIN_PASSWORD || 'test-password-123'
  )
}

async function getActivityEntries(superPb: PocketBase, organizationId: string, action: string, targetId?: string) {
  let filter = `organization = "${organizationId}" && action = "${action}"`
  if (targetId && action !== 'member_removed') {
    filter += ` && target = "${targetId}"`
  }
  const entries = await superPb.collection('team_activity_log').getFullList({
    filter,
    sort: '-logged_at',
    expand: 'actor,target'
  })
  if (!targetId || action !== 'member_removed') {
    return entries
  }
  return entries.filter((entry) => {
    const details = entry.details as { targetId?: string } | null | undefined
    return entry.target === targetId || details?.targetId === targetId
  })
}

describe('users collection security hooks (integration)', () => {
  const adminPb = new PocketBase(PB_URL)
  const viewerPb = new PocketBase(PB_URL)

  let organizationId: string
  let viewerUserId: string | undefined
  const viewerEmail = `users-hook-viewer-${Date.now()}@sitenook.test`

  beforeAll(async () => {
    const superPb = new PocketBase(PB_URL)
    await authSuperuser(superPb)

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
    if (adminPb.authStore.record?.role !== 'admin') {
      throw new Error('Test user must be org admin')
    }
    organizationId = adminPb.authStore.record?.organization as string
    if (!organizationId) {
      throw new Error('Test admin user has no organization')
    }

    const viewer = await superPb.collection('users').create({
      email: viewerEmail,
      password: 'viewer-password-123',
      passwordConfirm: 'viewer-password-123',
      name: 'Viewer Hook Test',
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
      await authSuperuser(superPb)
      if (viewerUserId) {
        await superPb.collection('users').delete(viewerUserId)
      }
    } catch {
      // already removed
    }
    adminPb.authStore.clear()
    viewerPb.authStore.clear()
  })

  it('allows a non-admin to update their own profile fields', async () => {
    if (!viewerUserId) throw new Error('missing viewer user')
    const updated = await viewerPb.collection('users').update(viewerUserId, {
      name: 'Viewer Renamed'
    })
    expect(updated.name).toBe('Viewer Renamed')
  })

  it('rejects a non-admin self-escalating their role', async () => {
    if (!viewerUserId) throw new Error('missing viewer user')
    await expect(
      viewerPb.collection('users').update(viewerUserId, { role: 'admin' })
    ).rejects.toSatisfy(expectRejected)
  })

  it('rejects a non-admin changing their organization', async () => {
    if (!viewerUserId) throw new Error('missing viewer user')
    await expect(
      viewerPb.collection('users').update(viewerUserId, {
        organization: 'fake-org-id'
      })
    ).rejects.toSatisfy(expectRejected)
  })

  it('allows an org admin to change another member role', async () => {
    if (!viewerUserId) throw new Error('missing viewer user')
    const updated = await adminPb.collection('users').update(viewerUserId, {
      role: 'admin',
      is_billing_contact: false
    })
    expect(updated.role).toBe('admin')

    const restored = await adminPb.collection('users').update(viewerUserId, {
      role: 'viewer',
      is_billing_contact: false
    })
    expect(restored.role).toBe('viewer')
  })

  it('rejects demoting the last admin in the organization', async () => {
    const superPb = new PocketBase(PB_URL)
    await authSuperuser(superPb)

    const adminId = adminPb.authStore.record?.id
    if (!adminId) throw new Error('missing admin user')

    const peerEmail = `users-hook-peer-${Date.now()}@sitenook.test`
    const peerAdmin = await superPb.collection('users').create({
      email: peerEmail,
      password: 'peer-password-123',
      passwordConfirm: 'peer-password-123',
      name: 'Peer Admin',
      role: 'admin',
      is_billing_contact: true,
      organization: organizationId,
      emailVisibility: true,
      verified: true
    })

    await superPb.collection('users').update(adminId, { role: 'viewer', is_billing_contact: false })

    await expect(
      adminPb.collection('users').update(peerAdmin.id, { role: 'viewer' })
    ).rejects.toSatisfy(expectRejected)

    await superPb.collection('users').update(adminId, { role: 'admin', is_billing_contact: true })
    await superPb.collection('users').delete(peerAdmin.id)
    superPb.authStore.clear()
  })

  it('rejects clearing billing contact on the last billing contact admin', async () => {
    const superPb = new PocketBase(PB_URL)
    await authSuperuser(superPb)

    const adminId = adminPb.authStore.record?.id
    if (!adminId) throw new Error('missing admin user')

    const peerEmail = `users-hook-billing-${Date.now()}@sitenook.test`
    const peerAdmin = await superPb.collection('users').create({
      email: peerEmail,
      password: 'peer-password-123',
      passwordConfirm: 'peer-password-123',
      name: 'Peer Billing Admin',
      role: 'admin',
      is_billing_contact: true,
      organization: organizationId,
      emailVisibility: true,
      verified: true
    })

    await superPb.collection('users').update(adminId, { is_billing_contact: false })

    await expect(
      adminPb.collection('users').update(peerAdmin.id, { is_billing_contact: false })
    ).rejects.toSatisfy(expectRejected)

    await superPb.collection('users').update(adminId, { is_billing_contact: true })
    await superPb.collection('users').delete(peerAdmin.id)
    superPb.authStore.clear()
  })

  it('rejects setting billing contact on a viewer', async () => {
    if (!viewerUserId) throw new Error('missing viewer user')
    await expect(
      adminPb.collection('users').update(viewerUserId, { is_billing_contact: true })
    ).rejects.toSatisfy(expectRejected)
  })

  it('auto-clears billing contact when demoting an admin who is not the last billing contact', async () => {
    const superPb = new PocketBase(PB_URL)
    await authSuperuser(superPb)

    const peerEmail = `users-hook-demote-${Date.now()}@sitenook.test`
    const peerAdmin = await superPb.collection('users').create({
      email: peerEmail,
      password: 'peer-password-123',
      passwordConfirm: 'peer-password-123',
      name: 'Demote Billing Admin',
      role: 'admin',
      is_billing_contact: true,
      organization: organizationId,
      emailVisibility: true,
      verified: true
    })

    const updated = await adminPb.collection('users').update(peerAdmin.id, { role: 'viewer' })
    expect(updated.role).toBe('viewer')
    expect(updated.is_billing_contact).toBe(false)

    await superPb.collection('users').delete(peerAdmin.id)
    superPb.authStore.clear()
  })

  it('writes activity log entries for member lifecycle events', async () => {
    const superPb = new PocketBase(PB_URL)
    await authSuperuser(superPb)

    const email = `users-hook-activity-${Date.now()}@sitenook.test`
    const created = await adminPb.collection('users').create({
      email,
      password: 'activity-password-123',
      passwordConfirm: 'activity-password-123',
      name: 'Activity Member',
      role: 'viewer',
      organization: organizationId,
      emailVisibility: true
    })

    const addedEntries = await getActivityEntries(superPb, organizationId, 'member_added', created.id)
    expect(addedEntries.length).toBeGreaterThan(0)

    await adminPb.collection('users').update(created.id, { role: 'admin', is_billing_contact: false })
    const roleEntries = await getActivityEntries(superPb, organizationId, 'role_changed', created.id)
    expect(roleEntries.length).toBeGreaterThan(0)
    expect(roleEntries[0]?.details).toMatchObject({ from: 'viewer', to: 'admin' })

    await adminPb.collection('users').update(created.id, { is_billing_contact: true })
    const billingAdded = await getActivityEntries(superPb, organizationId, 'billing_contact_added', created.id)
    expect(billingAdded.length).toBeGreaterThan(0)

    await adminPb.collection('users').update(created.id, { is_billing_contact: false })
    const billingRemoved = await getActivityEntries(superPb, organizationId, 'billing_contact_removed', created.id)
    expect(billingRemoved.length).toBeGreaterThan(0)

    await adminPb.collection('users').delete(created.id)
    const removedEntries = await getActivityEntries(superPb, organizationId, 'member_removed', created.id)
    expect(removedEntries.length).toBeGreaterThan(0)

    superPb.authStore.clear()
  })
})
