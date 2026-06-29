import { describe, it, expect } from 'vitest'
import { buildDefaultSiteScanConfig, buildDefaultSiteSettingsRecord, buildMigrationDefaultScanConfig } from '~/utils/defaultSiteScan'

describe('buildDefaultSiteScanConfig', () => {
  it('includes daily 14:00 schedule with timezone', () => {
    const raw = buildDefaultSiteScanConfig('https://example.com', 'Australia/Sydney')
    expect(raw.schedule).toEqual({
      frequency: 'daily',
      time: '14:00',
      timezone: 'Australia/Sydney'
    })
    expect(raw.mode).toBe('full')
    expect(raw.viewport).toBe('desktop')
  })

  it('buildDefaultSiteSettingsRecord returns site target defaults', () => {
    const settings = buildDefaultSiteSettingsRecord()
    expect(settings.wcagVersion).toBe('2.2')
    expect(settings.wcagConformance).toBe('AA')
  })

  it('migration helper uses UTC', () => {
    const raw = buildMigrationDefaultScanConfig('https://test.org')
    expect((raw.schedule as { timezone: string }).timezone).toBe('UTC')
    expect((raw.schedule as { time: string }).time).toBe('14:00')
  })
})
