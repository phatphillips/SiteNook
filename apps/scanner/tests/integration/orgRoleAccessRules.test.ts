import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import PocketBase, { ClientResponseError } from 'pocketbase'

const PB_URL = process.env.PB_TEST_URL || 'http://localhost:8091'
const ADMIN_EMAIL = process.env.PB_TEST_ADMIN_EMAIL || 'test-admin@accessiq.test'
const ADMIN_PASSWORD = process.env.PB_TEST_ADMIN_PASSWORD || 'test-password-123'

const VIEWER_EMAIL = 'viewer-org-read@accessiq.test'
const VIEWER_PASSWORD = 'viewer-org-read-password'

function isUpdateDenied(error: unknown): boolean {
  return error instanceof ClientResponseError && [403, 404].includes(error.status)
}

function isCreateDenied(error: unknown): boolean {
  return error instanceof ClientResponseError && [400, 403].includes(error.status)
}

describe('org role access rules (integration)', () => {
  const adminPb = new PocketBase(PB_URL)
  const viewerPb = new PocketBase(PB_URL)

  let organizationId: string
  let siteId: string
  let viewerUserId: string

  beforeAll(async () => {
    await adminPb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)

    const orgs = await adminPb.collection('organizations').getFullList({ limit: 1 })
    if (!orgs.length) {
      throw new Error('No organizations in test PocketBase — run migrations and seed')
    }
    organizationId = orgs[0].id

    const existingSites = await adminPb.collection('sites').getFullList({
      filter: `organization = "${organizationId}"`,
      limit: 1
    })
    if (existingSites.length) {
      siteId = existingSites[0].id
    } else {
      const site = await adminPb.collection('sites').create({
        name: 'Org Read Test Site',
        url: 'https://org-read.example.com',
        organization: organizationId,
        owner: adminPb.authStore.record?.id
      })
      siteId = site.id
    }

    const existingViewer = await adminPb.collection('users').getFullList({
      filter: `email = "${VIEWER_EMAIL}"`,
      limit: 1
    })
    if (existingViewer.length) {
      viewerUserId = existingViewer[0].id
      await adminPb.collection('users').update(viewerUserId, {
        role: 'viewer',
        organization: organizationId,
        verified: true
      })
    } else {
      const viewer = await adminPb.collection('users').create({
        email: VIEWER_EMAIL,
        password: VIEWER_PASSWORD,
        passwordConfirm: VIEWER_PASSWORD,
        name: 'Org Viewer',
        role: 'viewer',
        organization: organizationId,
        emailVisibility: true,
        verified: true
      })
      viewerUserId = viewer.id
    }

    await viewerPb.collection('users').authWithPassword(VIEWER_EMAIL, VIEWER_PASSWORD)
  })

  afterAll(async () => {
    adminPb.authStore.clear()
    viewerPb.authStore.clear()
  })

  it('allows any org member to list sites without site_access rows', async () => {
    const sites = await viewerPb.collection('sites').getFullList({
      filter: `organization = "${organizationId}"`
    })
    expect(sites.some(site => site.id === siteId)).toBe(true)
  })

  it('denies a viewer site updates and scan queue writes', async () => {
    await expect(
      viewerPb.collection('sites').update(siteId, { description: 'viewer should not write' })
    ).rejects.toSatisfy(isUpdateDenied)

    await expect(
      viewerPb.collection('scan_queue').create({
        site: siteId,
        scan_type: 'full',
        priority: 0,
        requested_by: viewerUserId,
        status: 'pending',
        raw_config: { mode: 'full', maxPages: 1, maxDepth: 1 }
      })
    ).rejects.toSatisfy(isCreateDenied)
  })

  it('allows an org admin to update the site and enqueue scans', async () => {
    const appAdminPb = new PocketBase(PB_URL)
    await appAdminPb.collection('users').authWithPassword(
      process.env.PB_TEST_USER_EMAIL || 'test-user@accessiq.test',
      process.env.PB_TEST_USER_PASSWORD || 'test-user-password-123'
    )

    const updated = await appAdminPb.collection('sites').update(siteId, {
      description: `admin write ${Date.now()}`
    })
    expect(updated.id).toBe(siteId)

    const queue = await appAdminPb.collection('scan_queue').create({
      site: siteId,
      scan_type: 'full',
      priority: 0,
      requested_by: appAdminPb.authStore.record?.id,
      status: 'pending',
      raw_config: { mode: 'full', maxPages: 1, maxDepth: 1 }
    })
    expect(queue.site).toBe(siteId)

    await adminPb.collection('scan_queue').delete(queue.id)
    appAdminPb.authStore.clear()
  })
})
