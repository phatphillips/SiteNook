import { describe, expect, it } from 'vitest'
import { parseStartAccessIntent } from '../../../server/utils/startAccess'

describe('parseStartAccessIntent', () => {
  it('allows free plan without checkout', () => {
    expect(parseStartAccessIntent({ plan: 'free' }, { devBypassAllowed: false })).toEqual({
      kind: 'free'
    })
  })

  it('allows Team trial without checkout', () => {
    expect(parseStartAccessIntent({ plan: 'team', trial: '1' }, { devBypassAllowed: false })).toEqual({
      kind: 'team_trial'
    })
  })

  it('requires checkout for paid team plan without trial flag', () => {
    const intent = parseStartAccessIntent({ plan: 'team' }, { devBypassAllowed: false })
    expect(intent).toEqual({
      kind: 'deny',
      redirectTo: '/pricing',
      message: 'Complete Stripe checkout for the team plan before continuing.'
    })
  })

  it('accepts paid checkout session for team plan', () => {
    expect(parseStartAccessIntent({
      plan: 'team',
      checkout: 'cs_test_123'
    }, { devBypassAllowed: false })).toEqual({
      kind: 'paid_checkout',
      sessionId: 'cs_test_123',
      plan: 'team'
    })
  })

  it('maps legacy standard slug to team checkout', () => {
    expect(parseStartAccessIntent({
      plan: 'standard',
      checkout: 'cs_test_123'
    }, { devBypassAllowed: false })).toEqual({
      kind: 'paid_checkout',
      sessionId: 'cs_test_123',
      plan: 'team'
    })
  })

  it('allows dev bypass for starter plan', () => {
    expect(parseStartAccessIntent({
      plan: 'starter',
      checkout: 'dev_bypass'
    }, { devBypassAllowed: true })).toEqual({
      kind: 'dev_bypass',
      plan: 'starter'
    })
  })

  it('denies enterprise self-service signup', () => {
    expect(parseStartAccessIntent({ plan: 'enterprise' }, { devBypassAllowed: false })).toEqual({
      kind: 'deny',
      redirectTo: '/pricing',
      message: 'Enterprise plans are arranged via sales. Choose another plan or contact us.'
    })
  })
})
