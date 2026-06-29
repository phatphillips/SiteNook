import { describe, it, expect } from 'vitest'
import {
  formatCrawlLogLinesAsText,
  summarizeCrawlLogErrors,
  trimLogLinesToRecent,
  type CrawlLogLine
} from '~/utils/crawlLog'

describe('crawlLog display helpers', () => {
  it('trimLogLinesToRecent keeps the newest lines', () => {
    const lines: CrawlLogLine[] = Array.from({ length: 60 }, (_, i) => ({
      id: `line-${i}`,
      ts: i,
      level: 'info',
      message: `message ${i}`
    }))
    const trimmed = trimLogLinesToRecent(lines, 50)
    expect(trimmed).toHaveLength(50)
    expect(trimmed[0]?.message).toBe('message 10')
    expect(trimmed[49]?.message).toBe('message 59')
  })

  it('formatCrawlLogLinesAsText includes level and message', () => {
    const text = formatCrawlLogLinesAsText([
      {
        id: '1',
        ts: Date.parse('2025-06-01T12:00:00Z'),
        level: 'error',
        message: 'HTTP 403 — page not scanned',
        url: 'https://example.com/page'
      }
    ])
    expect(text).toContain('ERROR')
    expect(text).toContain('https://example.com/page')
    expect(text).toContain('HTTP 403')
  })

  it('summarizeCrawlLogErrors aggregates HTTP error codes', () => {
    const lines: CrawlLogLine[] = [
      { id: '1', ts: 1, level: 'error', message: 'HTTP 503 — page not scanned' },
      { id: '2', ts: 2, level: 'error', message: 'HTTP 503 blocked' },
      { id: '3', ts: 3, level: 'info', message: 'ok' }
    ]
    expect(summarizeCrawlLogErrors(lines)).toBe('2 × HTTP 503')
    expect(summarizeCrawlLogErrors([])).toBeNull()
  })
})
