import { describe, expect, it, vi } from 'vitest'
import type PocketBase from 'pocketbase'
import { closeOrganization, closeOrganizationFromStripeSubscription } from '../../../server/utils/closeOrganization'

function createMockPb(org: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = []
  const activityLogs: Record<string, unknown>[] = []

  const pb = {
    collection(name: string) {
      if (name === 'organizations') {
        return {
          async getOne(id: string) {
            if (id !== org.id) throw new Error('not found')
            return org
          },
          async update(id: string, payload: Record<string, unknown>) {
            Object.assign(org, payload)
            updates.push(payload)
            return org
          }
        }
      }
      if (name === 'sites') {
        return {
          async getFullList() {
            return []
          }
        }
      }
      if (name === 'team_activity_log') {
        return {
          async create(payload: Record<string, unknown>) {
            activityLogs.push(payload)
            return { id: 'log1', ...payload }
          }
        }
      }
      throw new Error(`unexpected collection ${name}`)
    }
  } as unknown as PocketBase

  return { pb, updates, activityLogs }
}

describe('closeOrganization', () => {
  it('rejects when confirm name does not match', async () => {
    const { pb } = createMockPb({
      id: 'org1',
      name: 'Acme Agency',
      status: 'active',
      subdomain: 'acme'
    })

    await expect(closeOrganization(pb, null, {
      organizationId: 'org1',
      actorId: 'user1',
      confirmName: 'Wrong Name'
    })).rejects.toThrow(/does not match/)
  })

  it('marks organization closing and logs activity', async () => {
    const { pb, updates, activityLogs } = createMockPb({
      id: 'org1',
      name: 'Acme Agency',
      status: 'active',
      subdomain: 'acme',
      plan: 'team'
    })

    const stripe = {
      subscriptions: {
        cancel: vi.fn().mockResolvedValue({ id: 'sub_123' })
      }
    }

    const result = await closeOrganization(pb, stripe as never, {
      organizationId: 'org1',
      actorId: 'user1',
      confirmName: 'Acme Agency'
    })

    expect(result.subdomain).toBe('acme')
    expect(updates[0]).toMatchObject({
      status: 'closing',
      subscription_status: 'canceled',
      closed_by: 'user1'
    })
    expect(activityLogs[0]).toMatchObject({
      action: 'org_closed',
      organization: 'org1',
      actor: 'user1'
    })
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled()
  })

  it('cancels Stripe subscription when present', async () => {
    const { pb } = createMockPb({
      id: 'org1',
      name: 'Acme Agency',
      status: 'active',
      subdomain: 'acme',
      stripe_subscription_id: 'sub_123'
    })

    const stripe = {
      subscriptions: {
        cancel: vi.fn().mockResolvedValue({ id: 'sub_123' })
      }
    }

    const result = await closeOrganization(pb, stripe as never, {
      organizationId: 'org1',
      actorId: 'user1',
      confirmName: 'Acme Agency'
    })

    expect(result.subscriptionCanceled).toBe(true)
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
  })

  it('starts churn retention when Stripe subscription is canceled', async () => {
    const { pb, updates, activityLogs } = createMockPb({
      id: 'org1',
      name: 'Acme Agency',
      status: 'active',
      subdomain: 'acme',
      plan: 'team',
      stripe_subscription_id: 'sub_123'
    })

    const result = await closeOrganizationFromStripeSubscription(pb, {
      id: 'org1',
      name: 'Acme Agency',
      status: 'active',
      subdomain: 'acme',
      plan: 'team',
      stripe_subscription_id: 'sub_123',
      created: '',
      updated: ''
    }, { stripeEvent: 'customer.subscription.updated' })

    expect(result?.subdomain).toBe('acme')
    expect(updates[0]).toMatchObject({
      status: 'active',
      subscription_status: 'canceled',
      plan: 'team'
    })
    expect(updates[0]).toHaveProperty('purge_scheduled_at')
    expect(updates[0]).not.toHaveProperty('closed_by')
    expect(activityLogs[0]).toMatchObject({
      action: 'subscription_updated',
      details: expect.objectContaining({ churnRetention: true, source: 'stripe_subscription' })
    })
  })
})
