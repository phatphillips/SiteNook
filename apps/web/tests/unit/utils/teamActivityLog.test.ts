import { describe, it, expect } from 'vitest'
import {
  formatTeamActivityDetail,
  formatTeamActivitySentence,
  formatTeamActivityTimestamp,
  getTeamActivityActionMeta
} from '~/utils/teamActivityLog'

describe('teamActivityLog', () => {
  it('formats role change sentences', () => {
    const sentence = formatTeamActivitySentence({
      id: '1',
      action: 'role_changed',
      created: '2026-06-12T15:42:00.000Z',
      actor: { id: 'a1', name: 'Heather' },
      target: { id: 't1', name: 'PuffinPop', email: 'puffin@example.com' },
      details: { from: 'viewer', to: 'admin' }
    })

    expect(sentence).toContain('Heather changed PuffinPop')
    expect(sentence).toContain('Viewer')
    expect(sentence).toContain('Admin')
  })

  it('formats invite resent sentences and detail', () => {
    const entry = {
      id: '2',
      action: 'invite_resent',
      created: '2026-06-12T15:42:00.000Z',
      actor: { id: 'a1', name: 'Heather' },
      target: { id: 't1', name: 'PuffinPop', email: 'puffin@example.com' }
    }

    expect(formatTeamActivitySentence(entry)).toContain('resent the invite')
    expect(formatTeamActivityDetail(entry)).toContain('puffin@example.com')
  })

  it('formats member added detail with role and email', () => {
    const detail = formatTeamActivityDetail({
      id: '3',
      action: 'member_added',
      created: '2026-06-12T15:42:00.000Z',
      actor: { id: 'a1', name: 'Heather' },
      target: { id: 't1', name: 'PuffinPop', email: 'puffin@example.com' },
      details: { role: 'viewer' }
    })

    expect(detail).toContain('Role: Viewer')
    expect(detail).toContain('puffin@example.com')
  })

  it('exposes action metadata and timestamps', () => {
    const entry = {
      id: '4',
      action: 'billing_contact_added',
      created: '2026-06-12T15:42:00.000Z',
      actor: { id: 'a1', name: 'Heather' },
      target: { id: 't1', name: 'PuffinPop' }
    }

    expect(getTeamActivityActionMeta(entry.action).label).toBe('Billing contact added')
    expect(formatTeamActivityTimestamp(entry)).toContain('Jun')
  })

  it('formats analytics connect activity', () => {
    const entry = {
      id: '5',
      action: 'analytics_connected' as const,
      created: '2026-06-12T15:42:00.000Z',
      actor: { id: 'a1', name: 'Heather' },
      details: { provider: 'plausible', siteId: 's1', siteName: 'Marketing site' }
    }
    expect(formatTeamActivitySentence(entry)).toContain('Plausible Analytics')
    expect(formatTeamActivitySentence(entry)).toContain('Marketing site')
    expect(getTeamActivityActionMeta(entry.action).label).toBe('Analytics connected')
    expect(formatTeamActivityDetail(entry)).toContain('Plausible')
  })
})
