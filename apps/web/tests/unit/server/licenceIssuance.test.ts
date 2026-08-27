import { describe, expect, it } from 'vitest'
import {
  defaultSelfHostExpiry,
  generateLicenceKey,
  isSelfHostCheckoutSession,
  extractSelfHostCheckoutEmail
} from '../../../server/utils/licenceIssuance'

describe('licenceIssuance helpers', () => {
  it('generates unique licence keys', () => {
    const a = generateLicenceKey()
    const b = generateLicenceKey()
    expect(a).toMatch(/^nook_/)
    expect(a).not.toBe(b)
  })

  it('defaults expiry one month ahead', () => {
    const from = new Date('2026-01-15T00:00:00.000Z')
    const expiry = defaultSelfHostExpiry(1, from)
    expect(expiry.startsWith('2026-02-')).toBe(true)
  })

  it('detects selfhost checkout metadata', () => {
    expect(isSelfHostCheckoutSession({
      metadata: { sitenook_product: 'selfhost' }
    } as never)).toBe(true)
    expect(isSelfHostCheckoutSession({
      metadata: { sitenook_plan: 'team' }
    } as never)).toBe(false)
  })

  it('extracts customer email from checkout session', () => {
    expect(extractSelfHostCheckoutEmail({
      customer_details: { email: 'Buyer@Example.com' }
    } as never)).toBe('buyer@example.com')
  })
})

describe('issueSelfHostLicenceFromCheckout idempotency', () => {
  it('returns existing licence for the same checkout session', async () => {
    const { issueSelfHostLicenceFromCheckout } = await import(
      '../../../server/utils/licenceIssuance'
    )

    const store: Record<string, unknown>[] = []
    const pb = {
      collection() {
        return {
          async getFirstListItem(filter: string) {
            const match = store.find((row) => {
              if (filter.includes('stripe_checkout_session_id')) {
                return row.stripe_checkout_session_id === 'cs_test_1'
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
          }
        }
      }
    }

    const first = await issueSelfHostLicenceFromCheckout(pb as never, {
      customerEmail: 'a@example.com',
      stripeSubscriptionId: 'sub_1',
      stripeCheckoutSessionId: 'cs_test_1'
    })
    expect(first.created).toBe(true)

    const second = await issueSelfHostLicenceFromCheckout(pb as never, {
      customerEmail: 'a@example.com',
      stripeSubscriptionId: 'sub_1',
      stripeCheckoutSessionId: 'cs_test_1'
    })
    expect(second.created).toBe(false)
    expect(second.licence.key).toBe(first.licence.key)
    expect(store).toHaveLength(1)
  })
})
