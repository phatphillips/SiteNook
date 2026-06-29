import { describe, it, expect } from 'vitest'
import { CrawlDiagnostics } from '../../../src/crawler/crawlDiagnostics.js'
import { formatDiagnosticsLogLines } from '../../../src/db/scanLogEvents.js'

describe('formatDiagnosticsLogLines', () => {
  it('includes 403 guidance in summary lines', () => {
    const diag = new CrawlDiagnostics(false)
    diag.recordSeed(160)
    diag.attempted = 200
    diag.succeeded = 14
    diag.httpErrors.set(403, 186)
    diag.stopReason = 'queue_empty'
    diag.visitedCount = 212

    const lines = formatDiagnosticsLogLines(diag, 14, 500)
    const text = lines.map(l => l.message).join(' ')
    expect(text).toMatch(/403/)
    expect(lines.some(l => l.level === 'error')).toBe(true)
  })
})
