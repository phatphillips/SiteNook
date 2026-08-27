import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import {
  buildPaidCheckoutUpsertInput,
  isCheckoutSessionPaid,
  isStoredCheckoutSessionValid,
  resolveCheckoutCustomerEmail,
  resolveCheckoutOrganizationId,
  resolveCheckoutPlanFromSession,
  STRIPE_CHECKOUT_VALIDITY_MS
} from '../../../server/utils/stripeCheckoutRecord'

function mockSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_abc123',
    object: 'checkout.session',
    status: 'complete',
    payment_status: 'paid',
    mode: 'subscription',
    metadata: { sitenook_plan: 'team' },
    customer_details: { email: 'buyer@example.com' },
    customer: 'cus_test',
    subscription: 'sub_test',
    ...overrides
  } as Stripe.Checkout.Session
}

describe('stripeCheckoutRecord', () => {
  it('detects paid checkout sessions', () => {
    expect(isCheckoutSessionPaid(mockSession())).toBe(true)
    expect(isCheckoutSessionPaid(mockSession({ payment_status: 'unpaid' }))).toBe(false)
    expect(isCheckoutSessionPaid(mockSession({ status: 'open' }))).toBe(false)
  })

  it('builds upsert input from completed session', () => {
    const now = new Date('2026-06-14T12:00:00.000Z')
    const input = buildPaidCheckoutUpsertInput(mockSession(), now)
    expect(input).toEqual({
      sessionId: 'cs_test_abc123',
      plan: 'team',
      customerEmail: 'buyer@example.com',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      paidAt: now,
      expiresAt: new Date(now.getTime() + STRIPE_CHECKOUT_VALIDITY_MS)
    })
  })

  it('resolves plan from metadata with team fallback', () => {
    expect(resolveCheckoutPlanFromSession(mockSession())).toBe('team')
    expect(resolveCheckoutPlanFromSession(mockSession({ metadata: { sitenook_plan: 'standard' } }))).toBe('team')
    expect(resolveCheckoutPlanFromSession(mockSession({ metadata: {} }))).toBe('team')
  })

  it('resolves organization id from metadata', () => {
    expect(resolveCheckoutOrganizationId(mockSession())).toBeUndefined()
    expect(resolveCheckoutOrganizationId(mockSession({
      metadata: { sitenook_plan: 'team', organization_id: 'org_abc' }
    }))).toBe('org_abc')
  })

  it('normalizes customer email', () => {
    expect(resolveCheckoutCustomerEmail(mockSession({
      customer_details: { email: ' Buyer@Example.COM ' }
    }))).toBe('buyer@example.com')
  })

  it('validates stored checkout expiry', () => {
    const now = new Date('2026-06-14T12:00:00.000Z')
    expect(isStoredCheckoutSessionValid({
      status: 'paid',
      expires_at: '2026-06-15T12:00:00.000Z'
    }, now)).toBe(true)
    expect(isStoredCheckoutSessionValid({
      status: 'paid',
      expires_at: '2026-06-13T12:00:00.000Z'
    }, now)).toBe(false)
    expect(isStoredCheckoutSessionValid({
      status: 'consumed',
      expires_at: '2026-06-15T12:00:00.000Z'
    }, now)).toBe(false)
  })
})
