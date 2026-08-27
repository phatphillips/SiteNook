import { describe, expect, it } from 'vitest'
import {
  buildPricingComparisonRows,
  PRICING_COMPARISON_COLUMNS
} from '~/utils/pricingComparison'

describe('pricingComparison', () => {
  it('exposes Starter through Enterprise columns', () => {
    expect(PRICING_COMPARISON_COLUMNS.map(col => col.key)).toEqual([
      'starter',
      'team',
      'business',
      'enterprise'
    ])
  })

  it('builds rows from plan limits with accessible cell text', () => {
    const rows = buildPricingComparisonRows()
    const byFeature = Object.fromEntries(rows.map(row => [row.feature, row]))

    expect(byFeature.Sites).toMatchObject({
      starter: '3',
      team: '10',
      business: '25',
      enterprise: 'Custom / unlimited'
    })
    expect(byFeature['Scheduled scans']).toMatchObject({
      starter: '—',
      team: 'Included',
      business: 'Included',
      enterprise: 'Included'
    })
    expect(byFeature['SEO module']).toMatchObject({
      starter: '—',
      team: 'Included'
    })
    expect(byFeature['PDF accessibility']).toMatchObject({
      business: 'Included',
      team: '—'
    })
    expect(byFeature['SSO / SAML'].enterprise).toBe('On request')
    expect(byFeature['Self-hosted deployment'].enterprise).toBe('Available')
  })

  it('never uses empty cells for feature values', () => {
    for (const row of buildPricingComparisonRows()) {
      expect(row.starter.length).toBeGreaterThan(0)
      expect(row.team.length).toBeGreaterThan(0)
      expect(row.business.length).toBeGreaterThan(0)
      expect(row.enterprise.length).toBeGreaterThan(0)
    }
  })
})
