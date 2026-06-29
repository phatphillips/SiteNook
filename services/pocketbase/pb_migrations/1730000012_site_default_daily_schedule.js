/// <reference path="../pb_data/types.d.ts" />

function migrationDefaultScanConfig(siteUrl) {
  let sitemapUrl = ''
  try {
    const u = new URL(siteUrl)
    sitemapUrl = `${u.origin}/sitemap.xml`
  } catch {
    sitemapUrl = ''
  }
  return {
    mode: 'full',
    pages: [],
    sitemapUrl,
    maxPages: 500,
    maxDepth: 10,
    stayOnDomain: true,
    respectRobots: true,
    includePatterns: [],
    excludePatterns: ['/logout', '/wp-admin/*', '/cdn-cgi/*'],
    wcagVersion: '2.2',
    wcagLevels: ['A', 'AA', 'AAA'],
    bestPractices: true,
    checkLinks: true,
    checkSpelling: true,
    spellLanguage: 'en-AU',
    checkReadability: true,
    runPolicies: true,
    viewport: 'desktop',
    waitStrategy: 'networkidle',
    concurrency: 3,
    timeout: 30,
    auth: {
      type: 'none',
      usernameSelector: 'input[type=email], input[name=email]',
      passwordSelector: 'input[type=password]',
      submitSelector: 'button[type=submit]'
    },
    diffFromPrevious: true,
    customHeaders: {},
    userAgent: null,
    schedule: {
      frequency: 'daily',
      time: '14:00',
      timezone: 'UTC'
    }
  }
}

function nextDailyUtcAt1400(fromDate) {
  const now = fromDate || new Date()
  let next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    14,
    0,
    0,
    0
  ))
  if (next.getTime() <= now.getTime()) {
    next = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      14,
      0,
      0,
      0
    ))
  }
  return next.toISOString()
}

migrate((app) => {
  const collection = app.findCollectionByNameOrId('sites')
  const records = app.findAllRecords('sites')
  const now = new Date()

  for (const record of records) {
    const siteUrl = String(record.get('url') || 'https://example.com')
    const existingConfig = record.get('default_scan_config')
    const needsConfig = !existingConfig || (typeof existingConfig === 'object' && !Object.keys(existingConfig).length)

    record.set('crawl_schedule', 'daily')
    if (needsConfig) {
      record.set('default_scan_config', migrationDefaultScanConfig(siteUrl))
    } else if (existingConfig && typeof existingConfig === 'object') {
      const schedule = existingConfig.schedule || {}
      record.set('default_scan_config', {
        ...existingConfig,
        schedule: {
          frequency: schedule.frequency || 'daily',
          time: schedule.time || '14:00',
          timezone: schedule.timezone || 'UTC'
        }
      })
    }
    record.set('schedule_next_run_at', nextDailyUtcAt1400(now))
    record.set('schedule_last_enqueued_at', null)
    app.save(record)
  }

  app.save(collection)
}, (app) => {
  // Non-reversible: prior per-site schedule state is not restored.
  const records = app.findAllRecords('sites')
  for (const record of records) {
    record.set('crawl_schedule', 'manual')
    record.set('schedule_next_run_at', null)
    record.set('schedule_last_enqueued_at', null)
    app.save(record)
  }
})
