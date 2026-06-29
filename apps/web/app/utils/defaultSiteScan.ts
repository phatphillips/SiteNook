import {
  getBrowserTimezone,
  getDefaultScanConfig,
  serializeScanConfig
} from '~/utils/scanConfig'
import { getDefaultSiteSettings, serializeSiteSettings } from '~/utils/siteSettings'

/** Default crawl execution config for newly created sites. */
export function buildDefaultSiteScanConfig(
  siteUrl: string,
  timeZone?: string,
  maxPages = 500
): Record<string, unknown> {
  const tz = timeZone ?? getBrowserTimezone()
  const config = getDefaultScanConfig(siteUrl, maxPages)
  return serializeScanConfig(
    {
      ...config,
      scheduleEnabled: true,
      scheduleFrequency: 'daily',
      scheduleTime: '14:00'
    },
    { scheduleTimezone: tz }
  )
}

export function buildDefaultSiteSettingsRecord(): Record<string, unknown> {
  return serializeSiteSettings(getDefaultSiteSettings())
}

/** Static default used by PocketBase migrations (UTC baseline). */
export function buildMigrationDefaultScanConfig(siteUrl = 'https://example.com'): Record<string, unknown> {
  return buildDefaultSiteScanConfig(siteUrl, 'UTC')
}

export function buildMigrationDefaultSiteSettings(): Record<string, unknown> {
  return buildDefaultSiteSettingsRecord()
}
