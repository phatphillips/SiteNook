import { describe, expect, it } from 'vitest'
import {
  buildDevBypassStartUrl,
  isDevCheckoutBypassToken,
  parseCheckoutPlan,
  parseStripeDevBypassFlag,
  shouldAllowDevCheckoutBypass,
  STRIPE_CHECKOUT_DEV_BYPASS
} from '~/utils/stripeCheckout'

describe('stripeCheckout', () => {
  it('uses a stable dev bypass token', () => {
    expect(STRIPE_CHECKOUT_DEV_BYPASS).toBe('dev_bypass')
  })

  it('builds dev bypass start URLs with plan', () => {
    expect(buildDevBypassStartUrl('team')).toBe('/start?checkout=dev_bypass&plan=team')
  })

  it('recognizes dev bypass query tokens', () => {
    expect(isDevCheckoutBypassToken('dev_bypass')).toBe(true)
    expect(isDevCheckoutBypassToken('other')).toBe(false)
  })

  it('parses checkout plan slugs', () => {
    expect(parseCheckoutPlan('team')).toBe('team')
    expect(parseCheckoutPlan('standard')).toBe('team')
    expect(parseCheckoutPlan('pro')).toBeNull()
  })

  it('allows dev bypass on localhost when flag is on', () => {
    expect(shouldAllowDevCheckoutBypass({
      isDev: false,
      devBypassFlag: true,
      appDomain: 'localhost'
    })).toBe(true)
    expect(shouldAllowDevCheckoutBypass({
      isDev: false,
      devBypassFlag: false,
      appDomain: 'localhost'
    })).toBe(false)
  })

  it('parses dev bypass flag strings', () => {
    expect(parseStripeDevBypassFlag('true')).toBe(true)
    expect(parseStripeDevBypassFlag('false')).toBe(false)
  })
})
