import { describe, expect, it } from 'vitest'
import {
  isStripeAnnualCheckoutConfigured,
  isStripeCheckoutConfigured,
  isStripeLiveModeSecret,
  isStripeTestModeSecret,
  readStripeServerConfig,
  resolveStripePriceId,
  validateCheckoutPlanPrice,
  validateStripeSecretKey,
  validateStripePriceId
} from '../../../server/utils/stripeConfig'
import {
  resolveStripePriceIdForCurrency,
  validateCheckoutPlanPriceForCurrency
} from '../../../server/utils/stripePriceCurrency'

describe('stripeConfig', () => {
  it('reads server config from runtime shape', () => {
    const config = readStripeServerConfig({
      stripeSecretKey: ' sk_test_abc ',
      stripeWebhookSecret: ' whsec_abc ',
      stripeTeamPriceId: ' price_team ',
      stripeStarterPriceId: ' price_starter ',
      stripeBusinessPriceId: ' price_business ',
      stripeDevBypassToken: ' dev_bypass ',
      public: { stripePublishableKey: ' pk_test_abc ' }
    })

    expect(config.secretKey).toBe('sk_test_abc')
    expect(config.webhookSecret).toBe('whsec_abc')
    expect(config.teamPriceId).toBe('price_team')
    expect(config.starterPriceId).toBe('price_starter')
    expect(config.businessPriceId).toBe('price_business')
    expect(config.publishableKey).toBe('pk_test_abc')
    expect(config.devBypassToken).toBe('dev_bypass')
  })

  it('falls back legacy standard price id to team', () => {
    const config = readStripeServerConfig({
      stripeStandardPriceId: ' price_legacy '
    })
    expect(config.teamPriceId).toBe('price_legacy')
  })

  it('detects configured checkout when secret and team price id exist', () => {
    expect(isStripeCheckoutConfigured({
      secretKey: 'sk_test_x',
      webhookSecret: '',
      starterPriceId: '',
      teamPriceId: 'price_x',
      businessPriceId: '',
      starterPriceIdAud: '',
      teamPriceIdAud: '',
      businessPriceIdAud: '',
      starterAnnualPriceId: '',
      teamAnnualPriceId: '',
      businessAnnualPriceId: '',
      starterAnnualPriceIdAud: '',
      teamAnnualPriceIdAud: '',
      businessAnnualPriceIdAud: '',
      publishableKey: '',
      devBypassToken: 'dev_bypass'
    })).toBe(true)
  })

  it('detects annual checkout when team annual price exists', () => {
    expect(isStripeAnnualCheckoutConfigured({
      secretKey: 'sk_test_x',
      webhookSecret: '',
      starterPriceId: '',
      teamPriceId: 'price_x',
      businessPriceId: '',
      starterPriceIdAud: '',
      teamPriceIdAud: '',
      businessPriceIdAud: '',
      starterAnnualPriceId: '',
      teamAnnualPriceId: 'price_annual',
      businessAnnualPriceId: '',
      starterAnnualPriceIdAud: '',
      teamAnnualPriceIdAud: '',
      businessAnnualPriceIdAud: '',
      publishableKey: '',
      devBypassToken: 'dev_bypass'
    })).toBe(true)
  })

  it('validates Stripe secret key prefixes', () => {
    expect(isStripeTestModeSecret('sk_test_abc')).toBe(true)
    expect(isStripeLiveModeSecret('sk_live_abc')).toBe(true)
    expect(validateStripeSecretKey('sk_test_abc')).toBeNull()
    expect(validateStripeSecretKey('invalid')).toMatch(/sk_test_|sk_live_/)
  })

  it('rejects product IDs used as price id', () => {
    expect(validateStripePriceId('prod_abc')).toMatch(/Price ID/)
    expect(validateStripePriceId('price_abc')).toBeNull()
  })

  it('resolves plan-specific price ids', () => {
    const config = readStripeServerConfig({
      stripeStarterPriceId: 'price_starter',
      stripeTeamPriceId: 'price_team',
      stripeBusinessPriceId: 'price_business',
      stripeStarterAnnualPriceId: 'price_starter_annual',
      stripeTeamAnnualPriceId: 'price_team_annual',
      stripeBusinessAnnualPriceId: 'price_business_annual'
    })

    expect(resolveStripePriceId(config, 'starter', 'monthly')).toBe('price_starter')
    expect(resolveStripePriceId(config, 'team', 'annual')).toBe('price_team_annual')
    expect(validateCheckoutPlanPrice(config, 'business', 'monthly')).toBeNull()
  })

  it('falls back to main price ids for non-USD when AUD-specific ids are unset', () => {
    const config = readStripeServerConfig({
      stripeTeamPriceId: 'price_team_aud'
    })

    expect(resolveStripePriceIdForCurrency(config, 'team', 'monthly', 'aud')).toBe('price_team_aud')
    expect(validateCheckoutPlanPriceForCurrency(config, 'team', 'monthly', 'aud')).toBeNull()
  })
})
