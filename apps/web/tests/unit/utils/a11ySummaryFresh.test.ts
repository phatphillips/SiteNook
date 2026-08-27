import { describe, expect, it } from 'vitest'
import { isA11ySummaryFresh } from '~/utils/a11ySummary'

describe('isA11ySummaryFresh', () => {
  it('rejects empty or stale summaries', () => {
    expect(isA11ySummaryFresh({ generated_at: '2026-01-01T00:00:00.000Z', by_rule: [] })).toBe(false)
    expect(isA11ySummaryFresh(
      {
        generated_at: '2026-01-01T00:00:00.000Z',
        by_rule: [{ rule_id: 'color-contrast' } as never]
      },
      '2026-01-02T00:00:00.000Z'
    )).toBe(false)
  })

  it('accepts a summary generated at or after the latest scan', () => {
    expect(isA11ySummaryFresh(
      {
        generated_at: '2026-01-02T00:00:01.000Z',
        by_rule: [{ rule_id: 'color-contrast' } as never]
      },
      '2026-01-02T00:00:00.000Z'
    )).toBe(true)
  })
})
