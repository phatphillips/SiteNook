import { describe, expect, it } from 'vitest'

import { formatBreakdownDelta, progressScoreSlices } from '~/utils/scoreBreakdown'

describe('scoreBreakdown', () => {
  it('builds score vs remaining slices with primary/muted tokens', () => {
    const slices = progressScoreSlices(70, {
      scoreLabel: 'Current score',
      remainderLabel: 'Remaining to 100'
    })
    expect(slices).toHaveLength(2)
    expect(slices[0]).toMatchObject({
      id: 'score',
      label: 'Current score',
      value: 70,
      color: 'var(--donut-segment-1)',
      score: 70
    })
    expect(slices[1]).toMatchObject({
      id: 'remaining',
      value: 30,
      color: 'var(--score-donut-track)'
    })
  })

  it('formats deltas with a leading sign for gains', () => {
    expect(formatBreakdownDelta(1.3)).toBe('+1.3')
    expect(formatBreakdownDelta(-2)).toBe('-2')
    expect(formatBreakdownDelta(null)).toBeNull()
  })
})
