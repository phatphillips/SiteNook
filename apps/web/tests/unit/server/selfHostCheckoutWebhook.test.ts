import { describe, expect, it } from 'vitest'
import {
  issueSelfHostLicenceFromCheckout,
  isSelfHostCheckoutSession,
  revokeLicencesForStripeSubscription
} from '../../../server/utils/licenceIssuance'

describe('self-host checkout webhook helpers', () => {
  it('detects selfhost product metadata', () => {
    expect(isSelfHostCheckoutSession({
      metadata: { sitenook_product: 'selfhost' }
    } as never)).toBe(true)
  })

  it('issues once per checkout session (idempotent)', async () => {
    const store: Record<string, unknown>[] = []
    const pb = {
      collection() {
        return {
          async getFirstListItem(filter: string) {
            const match = store.find((row) => {
              if (filter.includes('stripe_checkout_session_id')) {
                return row.stripe_checkout_session_id === 'cs_selfhost_1'
              }
              if (filter.includes('stripe_subscription_id')) {
                return row.stripe_subscription_id === 'sub_1' && row.revoked === false
              }
              return false
            })
            if (!match) throw Object.assign(new Error('missing'), { status: 404 })
            return match
          },
          async create(data: Record<string, unknown>) {
            const row = { id: `lic_${store.length + 1}`, ...data }
            store.push(row)
            return row
          },
          async getFullList() {
            return store.filter(row => row.stripe_subscription_id === 'sub_1' && row.revoked === false)
          },
          async update(id: string, data: Record<string, unknown>) {
            const row = store.find(r => r.id === id)
            if (row) Object.assign(row, data)
            return row
          }
        }
      }
    }

    const first = await issueSelfHostLicenceFromCheckout(pb as never, {
      customerEmail: 'buyer@example.com',
      stripeSubscriptionId: 'sub_1',
      stripeCheckoutSessionId: 'cs_selfhost_1',
      expiresAt: '2026-09-08T00:00:00.000Z'
    })
    expect(first.created).toBe(true)
    expect(first.licence.tier).toBe('selfhost')

    const second = await issueSelfHostLicenceFromCheckout(pb as never, {
      customerEmail: 'buyer@example.com',
      stripeSubscriptionId: 'sub_1',
      stripeCheckoutSessionId: 'cs_selfhost_1'
    })
    expect(second.created).toBe(false)
    expect(store).toHaveLength(1)

    const revoked = await revokeLicencesForStripeSubscription(pb as never, 'sub_1')
    expect(revoked).toBe(1)
    expect(store[0]?.revoked).toBe(true)
  })
})
