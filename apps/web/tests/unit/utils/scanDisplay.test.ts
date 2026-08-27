import { describe, it, expect } from 'vitest'
import {
  buildDisplayScansFilter,
  buildLatestCompleteScanMap,
  canStopActiveScanRow,
  formatElapsedSince,
  pickDisplayScan,
  pickLatestCompleteScan,
  pickLatestTrustedScan,
  scanActiveStatusLabel,
  scanStatusUiColor,
  scanStatusUiIcon,
  sortScansForDisplay
} from '~/utils/scanDisplay'
import type { Scan } from '~/types/sitenook'

describe('scanDisplay', () => {
  it('buildDisplayScansFilter includes complete, complete_with_errors, and running', () => {
    expect(buildDisplayScansFilter('site-1')).toBe(
      'site = "site-1" && (status = \'complete\' || status = \'complete_with_errors\' || status = \'running\')'
    )
  })

  it('pickDisplayScan prefers running scan over older complete', () => {
    const scans: Scan[] = [
      {
        id: 'old',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 10,
        completed_at: '2025-06-01T12:00:00Z'
      },
      {
        id: 'live',
        site: 's1',
        status: 'running',
        scan_type: 'full',
        pages_crawled: 2,
        started_at: '2025-06-02T10:00:00Z'
      }
    ]
    expect(pickDisplayScan(scans)?.id).toBe('live')
  })

  it('sortScansForDisplay orders by completed_at when both complete', () => {
    const scans: Scan[] = [
      {
        id: 'a',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 1,
        completed_at: '2025-01-01'
      },
      {
        id: 'b',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 1,
        completed_at: '2025-06-01'
      }
    ]
    expect(sortScansForDisplay(scans).map(s => s.id)).toEqual(['b', 'a'])
  })

  it('canStopActiveScanRow includes background_scan', () => {
    expect(canStopActiveScanRow('background_scan')).toBe(true)
    expect(canStopActiveScanRow('running')).toBe(true)
    expect(canStopActiveScanRow('complete')).toBe(false)
  })

  it('scanStatusUiColor maps running and terminal states', () => {
    expect(scanStatusUiColor('running')).toBe('info')
    expect(scanStatusUiColor('complete')).toBe('success')
    expect(scanStatusUiColor('failed')).toBe('error')
    expect(scanStatusUiColor('cancelled')).toBe('warning')
    expect(scanStatusUiColor('stopping')).toBe('warning')
  })

  it('scanActiveStatusLabel covers queue and stopping states', () => {
    expect(scanActiveStatusLabel('processing')).toBe('Starting')
    expect(scanActiveStatusLabel('queued')).toBe('Queued')
    expect(scanActiveStatusLabel('stopping')).toBe('Stopping?')
    expect(scanActiveStatusLabel('cancelled')).toBe('Stopped')
  })

  it('formatElapsedSince formats mm:ss and hh:mm:ss', () => {
    const start = '2025-06-01T12:00:00.000Z'
    const now = Date.parse('2025-06-01T12:01:05.000Z')
    expect(formatElapsedSince(start, now)).toBe('1:05')
    const later = Date.parse('2025-06-01T13:05:07.000Z')
    expect(formatElapsedSince(start, later)).toBe('1:05:07')
  })

  it('scanStatusUiIcon uses spinner for running', () => {
    expect(scanStatusUiIcon('running')).toBe('i-lucide-loader-circle')
    expect(scanStatusUiIcon('complete')).toBe('i-lucide-circle-check')
  })

  it('pickLatestCompleteScan ignores newer failed orphan', () => {
    const scans: Scan[] = [
      {
        id: 'good',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 10,
        completed_at: '2025-06-01T12:00:00Z',
        score_aa: 80
      },
      {
        id: 'orphan',
        site: 's1',
        status: 'failed',
        scan_type: 'full',
        pages_crawled: 0,
        completed_at: '2025-06-02T10:00:00Z',
        error_message: 'Scan interrupted — worker restarted'
      }
    ]
    expect(pickLatestCompleteScan(scans)?.id).toBe('good')
    expect(buildLatestCompleteScanMap(scans).get('s1')?.id).toBe('good')
  })

  it('pickLatestTrustedScan skips an untrusted newer scan', () => {
    const scans: Scan[] = [
      {
        id: 'trusted',
        site: 's1',
        status: 'complete',
        scan_type: 'full',
        pages_crawled: 10,
        completed_at: '2025-06-01T12:00:00Z',
        score_overall: 82
      },
      {
        id: 'bad',
        site: 's1',
        status: 'complete_with_errors',
        scan_type: 'full',
        pages_crawled: 1,
        completed_at: '2025-06-02T12:00:00Z',
        score_overall: 100,
        scan_quality: {
          pages_attempted: 10,
          pages_saved: 1,
          axe_failed: 1,
          http_errors: 8,
          timeouts: 0,
          network_errors: 0,
          trusted: false,
          reason: 'High crawl error rate'
        }
      }
    ]
    expect(pickLatestTrustedScan(scans)?.id).toBe('trusted')
  })
})
