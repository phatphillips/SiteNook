import { describe, expect, it } from 'vitest'
import { dismissActionItems, dismissMenuItem, issueRowActionGroups } from '~/utils/issueActions'

describe('issueActions', () => {
  it('builds dismiss items with consistent labels and icons', () => {
    const reasons: string[] = []
    const items = dismissActionItems(reason => reasons.push(reason))
    expect(items).toHaveLength(3)
    expect(items.map(i => i.label)).toEqual([
      'Won\'t fix',
      'False positive',
      'Defer'
    ])
    expect(items.map(i => i.icon)).toEqual([
      'i-lucide-ban',
      'i-lucide-circle-x',
      'i-lucide-clock'
    ])
    items[0]?.onSelect?.()
    expect(reasons).toEqual(['wont_fix'])
  })

  it('builds a single dismiss menu item with nested reasons', () => {
    const reasons: string[] = []
    const item = dismissMenuItem(reason => reasons.push(reason))
    expect(item.label).toBe('Dismiss')
    expect(item.children).toHaveLength(3)
    item.children?.[1]?.onSelect?.()
    expect(reasons).toEqual(['false_positive'])
  })

  it('builds grouped row actions with Mark as fixed above nested Dismiss', () => {
    const groups = issueRowActionGroups({
      onViewDetails: () => {},
      onRescan: () => {},
      onMarkFixed: () => {},
      onDismiss: () => {}
    })
    expect(groups).toHaveLength(2)
    expect(groups[0]?.map(i => i.label)).toEqual([
      'View details',
      'Rescan page'
    ])
    expect(groups[1]?.map(i => i.label)).toEqual([
      'Mark as fixed',
      'Dismiss'
    ])
    expect(groups[1]?.[1]?.children).toHaveLength(3)
  })
})
