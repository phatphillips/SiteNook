/// <reference path="../pb_data/types.d.ts" />

function defaultSiteSettingsFromScanConfig(scanConfig) {
  const cfg = scanConfig && typeof scanConfig === 'object' ? scanConfig : {}
  const levels = Array.isArray(cfg.wcagLevels) ? cfg.wcagLevels : ['A', 'AA', 'AAA']
  let wcagConformance = 'AA'
  if (levels.includes('AAA')) wcagConformance = 'AAA'
  else if (levels.includes('AA')) wcagConformance = 'AA'
  else if (levels.includes('A')) wcagConformance = 'A'

  return {
    wcagVersion: cfg.wcagVersion || '2.2',
    wcagConformance,
    ariaConformance: true,
    bestPractices: cfg.bestPractices !== false,
    includeIssues: true,
    includePotentialIssues: true,
    checkLinks: cfg.checkLinks !== false,
    checkSpelling: cfg.checkSpelling !== false,
    spellLanguage: cfg.spellLanguage || 'en-AU',
    checkReadability: cfg.checkReadability !== false,
    runPolicies: cfg.runPolicies !== false,
    notifyEmail: cfg.notifyEmail ?? null,
    diffFromPrevious: cfg.diffFromPrevious !== false
  }
}

function executionOnlyScanConfig(scanConfig, siteUrl) {
  const cfg = scanConfig && typeof scanConfig === 'object' ? { ...scanConfig } : {}
  let sitemapUrl = cfg.sitemapUrl || ''
  if (!sitemapUrl && siteUrl) {
    try {
      sitemapUrl = `${new URL(siteUrl).origin}/sitemap.xml`
    } catch {
      sitemapUrl = ''
    }
  }

  const schedule = cfg.schedule || {
    frequency: 'daily',
    time: '14:00',
    timezone: 'UTC'
  }

  return {
    mode: cfg.mode || 'full',
    pages: cfg.pages || [],
    sitemapUrl,
    maxPages: cfg.maxPages ?? 500,
    maxDepth: cfg.maxDepth ?? 10,
    stayOnDomain: cfg.stayOnDomain !== false,
    respectRobots: cfg.respectRobots !== false,
    includePatterns: cfg.includePatterns || [],
    excludePatterns: cfg.excludePatterns || ['/logout', '/wp-admin/*', '/cdn-cgi/*'],
    viewport: cfg.viewport || 'desktop',
    waitStrategy: cfg.waitStrategy || 'networkidle',
    concurrency: cfg.concurrency ?? 3,
    timeout: cfg.timeout ?? 30,
    auth: cfg.auth || {
      type: 'none',
      usernameSelector: 'input[type=email], input[name=email]',
      passwordSelector: 'input[type=password]',
      submitSelector: 'button[type=submit]'
    },
    customHeaders: cfg.customHeaders || {},
    userAgent: cfg.userAgent ?? null,
    schedule
  }
}

migrate((app) => {
  const collection = app.findCollectionByNameOrId('sites')

  if (!collection.fields.getByName('site_settings')) {
    collection.fields.add(new Field({ name: 'site_settings', type: 'json' }))
  }

  const records = app.findAllRecords('sites')
  for (const record of records) {
    const siteUrl = String(record.get('url') || 'https://example.com')
    const existingConfig = record.get('default_scan_config')
    const existingSettings = record.get('site_settings')

    if (!existingSettings || (typeof existingSettings === 'object' && !Object.keys(existingSettings).length)) {
      record.set('site_settings', defaultSiteSettingsFromScanConfig(existingConfig))
    }

    record.set('default_scan_config', executionOnlyScanConfig(existingConfig, siteUrl))
    app.save(record)
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('sites')
  if (collection.fields.getByName('site_settings')) {
    collection.fields.removeByName('site_settings')
    app.save(collection)
  }
})
