import { describe, expect, it } from 'vitest'
import { dismissActionItems, issueRowActionGroups } from '~/utils/issueActions'

describe('issueActions', () => {
  it('builds dismiss items with consistent labels and icons', () => {
    const reasons: string[] = []
    const items = dismissActionItems(reason => reasons.push(reason))
    expect(items).toHaveLength(3)
    expect(items.map(i => i.label)).toEqual([
      'Dismiss — won\'t fix',
      'Dismiss — false positive',
      'Dismiss — defer'
    ])
    expect(items.every(i => i.icon === 'i-lucide-x')).toBe(true)
    items[0]?.onSelect?.()
    expect(reasons).toEqual(['wont_fix'])
  })

  it('builds grouped row actions with a dismiss section', () => {
    const groups = issueRowActionGroups({
      onViewDetails: () => {},
      onRescan: () => {},
      onMarkFixed: () => {},
      onDismiss: () => {}
    })
    expect(groups).toHaveLength(2)
    expect(groups[0]?.map(i => i.label)).toEqual([
      'View details',
      'Rescan page',
      'Mark as fixed'
    ])
    expect(groups[1]).toHaveLength(3)
  })
})
