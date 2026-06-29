import { describe, expect, it, vi } from 'vitest'
import type { Organization } from '~/types/accessiq'
import { syncStripeOrganizationBilling } from '../../../server/utils/syncStripeBilling'

vi.mock('../../../server/utils/orgClosureNotify', () => ({
  notifyOrgChurnEmails: vi.fn().mockResolvedValue({ sent: 1 })
}))

function mockOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org_test',
    name: 'Test Org',
    subdomain: 'test',
    plan: 'team',
    status: 'active',
    stripe_subscription_id: 'sub_old',
    stripe_customer_id: 'cus_test',
    subscription_status: 'active',
    created: '',
    updated: '',
    ...overrides
  }
}

function createMockPb(org: Organization) {
  return {
    collection(name: string) {
      if (name === 'organizations') {
        return {
          async getOne(id: string) {
            if (id !== org.id) throw new Error('not found')
            return { ...org }
          },
          async update(id: string, payload: Record<string, unknown>) {
            Object.assign(org, payload)
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
          async create() {
            return { id: 'log1' }
          }
        }
      }
      throw new Error(`unexpected ${name}`)
    }
  } as unknown as import('pocketbase').default
}

describe('syncStripeOrganizationBilling', () => {
  it('starts churn retention when the linked subscription is set to cancel at period end', async () => {
    const org = mockOrg()
    const pb = createMockPb(org)
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockRejectedValue({ code: 'resource_missing' }),
        list: vi.fn().mockResolvedValue({
          data: [{
            id: 'sub_linked',
            status: 'active',
            cancel_at_period_end: true,
            customer: 'cus_test',
            metadata: { organization_id: 'org_test' },
            created: 2
          }, {
            id: 'sub_old',
            status: 'active',
            cancel_at_period_end: false,
            customer: 'cus_test',
            metadata: {},
            created: 1
          }]
        })
      }
    }

    const result = await syncStripeOrganizationBilling(pb, stripe as never, org)

    expect(result.retentionStarted).toBe(true)
    expect(result.organization.status).toBe('active')
    expect(result.organization.subscription_status).toBe('canceled')
    expect(org.stripe_subscription_id).toBe('sub_linked')
  })

  it('repairs mistaken Stripe closure when org is closing without closed_by', async () => {
    const org = mockOrg({ status: 'closing', closed_by: undefined })
    const pb = createMockPb(org)
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockRejectedValue({ code: 'resource_missing' }),
        list: vi.fn().mockResolvedValue({ data: [] })
      }
    }

    const result = await syncStripeOrganizationBilling(pb, stripe as never, org)

    expect(result.organization.status).toBe('active')
    expect(result.organization.subscription_status).toBe('canceled')
  })

  it('returns existing org when admin-closed (closed_by set)', async () => {
    const org = mockOrg({ status: 'closing', closed_by: 'user_admin' })
    const pb = createMockPb(org)
    const stripe = {
      subscriptions: {
        retrieve: vi.fn(),
        list: vi.fn()
      }
    }

    const result = await syncStripeOrganizationBilling(pb, stripe as never, org)

    expect(result.retentionStarted).toBe(false)
    expect(stripe.subscriptions.list).not.toHaveBeenCalled()
  })
})
