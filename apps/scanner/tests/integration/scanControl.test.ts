import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_TEST_URL || 'http://localhost:8091'
const USER_EMAIL = process.env.PB_TEST_USER_EMAIL || 'test-user@sitenook.test'
const USER_PASSWORD = process.env.PB_TEST_USER_PASSWORD || 'test-user-password-123'

describe('scan control (integration)', () => {
  const pb = new PocketBase(PB_URL)
  let siteId: string
  let queueId: string

  beforeAll(async () => {
    await pb.collection('users').authWithPassword(USER_EMAIL, USER_PASSWORD)

    const sites = await pb.collection('sites').getFullList({ limit: 1 })
    if (sites.length) {
      siteId = sites[0].id
    } else {
      const organization = pb.authStore.record?.organization
      if (!organization) {
        throw new Error('Test user has no organization — run patch-multi-tenant or migration 1730000020')
      }
      const site = await pb.collection('sites').create({
        name: 'Control Test Site',
        url: 'https://example.com',
        owner: pb.authStore.record?.id,
        organization
      })
      siteId = site.id
    }

    const queue = await pb.collection('scan_queue').create({
      site: siteId,
      scan_type: 'full',
      priority: 0,
      requested_by: pb.authStore.record?.id,
      status: 'pending',
      raw_config: { mode: 'full', maxPages: 1, maxDepth: 1 }
    })
    queueId = queue.id
  })

  afterAll(async () => {
    if (queueId) {
      try {
        await pb.collection('scan_queue').delete(queueId)
      } catch {
        // already removed
      }
    }
    pb.authStore.clear()
  })

  it('allows authenticated user to cancel a pending queue item', async () => {
    const updated = await pb.collection('scan_queue').update(queueId, { status: 'cancelled' })
    expect(updated.status).toBe('cancelled')
  })

  it('allows authenticated user to update and delete scans', async () => {
    const scan = await pb.collection('scans').create({
      site: siteId,
      status: 'running',
      scan_type: 'full',
      pages_crawled: 0,
      raw_config: { mode: 'full', maxPages: 1 }
    })

    const cancelled = await pb.collection('scans').update(scan.id, { status: 'cancelled' })
    expect(cancelled.status).toBe('cancelled')

    await pb.collection('scans').delete(scan.id)
    await expect(pb.collection('scans').getOne(scan.id)).rejects.toThrow()
  })
})
