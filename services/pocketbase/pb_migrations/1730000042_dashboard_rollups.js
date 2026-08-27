/// <reference path="../pb_data/types.d.ts" />

const SITE_ACCESS = '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS}${siteField}))`
}

function orgRule() {
  return 'org = @request.auth.organization'
}

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const organizations = app.findCollectionByNameOrId('organizations')

  const siteSummary = new Collection({
    name: 'site_dashboard_summary',
    type: 'base',
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'site', type: 'relation', required: true, collectionId: sites.id, maxSelect: 1, cascadeDelete: true },
      { name: 'org', type: 'relation', required: true, collectionId: organizations.id, maxSelect: 1, cascadeDelete: true },
      { name: 'avg_accessibility', type: 'number', min: 0, max: 100 },
      { name: 'avg_qa', type: 'number', min: 0, max: 100 },
      { name: 'avg_seo', type: 'number', min: 0, max: 100 },
      { name: 'open_a11y_count', type: 'number', min: 0 },
      { name: 'open_qa_count', type: 'number', min: 0 },
      { name: 'open_seo_count', type: 'number', min: 0 },
      { name: 'attention_worst_score', type: 'number', min: 0, max: 100 },
      { name: 'attention_open_total', type: 'number', min: 0 },
      { name: 'attention_last_scan_at', type: 'date' },
      { name: 'source_scan_at', type: 'date' }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_site_dashboard_summary_site ON site_dashboard_summary (site)',
      'CREATE INDEX idx_site_dashboard_summary_org_site ON site_dashboard_summary (org, site)',
      'CREATE INDEX idx_site_dashboard_summary_org_worst ON site_dashboard_summary (org, attention_worst_score)',
      'CREATE INDEX idx_site_dashboard_summary_org_open_total ON site_dashboard_summary (org, attention_open_total)',
      'CREATE INDEX idx_site_dashboard_summary_org_last_scan ON site_dashboard_summary (org, attention_last_scan_at)'
    ]
  })
  app.save(siteSummary)

  const orgSummary = new Collection({
    name: 'org_dashboard_summary',
    type: 'base',
    listRule: orgRule(),
    viewRule: orgRule(),
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'org', type: 'relation', required: true, collectionId: organizations.id, maxSelect: 1, cascadeDelete: true },
      { name: 'avg_accessibility', type: 'number', min: 0, max: 100 },
      { name: 'avg_qa', type: 'number', min: 0, max: 100 },
      { name: 'avg_seo', type: 'number', min: 0, max: 100 },
      { name: 'open_a11y_count', type: 'number', min: 0 },
      { name: 'open_qa_count', type: 'number', min: 0 },
      { name: 'open_seo_count', type: 'number', min: 0 },
      { name: 'attention_worst_score', type: 'number', min: 0, max: 100 },
      { name: 'attention_open_total', type: 'number', min: 0 },
      { name: 'attention_last_scan_at', type: 'date' },
      { name: 'source_scan_at', type: 'date' }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_org_dashboard_summary_org ON org_dashboard_summary (org)',
      'CREATE INDEX idx_org_dashboard_summary_worst ON org_dashboard_summary (attention_worst_score)',
      'CREATE INDEX idx_org_dashboard_summary_open_total ON org_dashboard_summary (attention_open_total)',
      'CREATE INDEX idx_org_dashboard_summary_last_scan ON org_dashboard_summary (attention_last_scan_at)'
    ]
  })
  app.save(orgSummary)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('site_dashboard_summary'))
  } catch (_) {}
  try {
    app.delete(app.findCollectionByNameOrId('org_dashboard_summary'))
  } catch (_) {}
})
