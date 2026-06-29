import { describe, expect, it } from 'vitest'
import { resolveSubscriptionItemPriceId } from '../../../server/utils/subscriptionPlanChange'

describe('subscriptionPlanChange', () => {
  it('reads price id from subscription item', () => {
    expect(resolveSubscriptionItemPriceId({
      id: 'si_test',
      price: { id: 'price_team' }
    } as never)).toBe('price_team')

    expect(resolveSubscriptionItemPriceId({
      id: 'si_test',
      price: 'price_team'
    } as never)).toBe('price_team')
  })
})
