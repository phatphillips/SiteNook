/// <reference path="../pb_data/types.d.ts" />

const SITE_ACCESS = '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS}${siteField}))`
}

function orgRule() {
  return 'org = @request.auth.organization'
}

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')

  const reportJobs = new Collection({
    name: 'report_jobs',
    type: 'base',
    listRule: orgRule(),
    viewRule: orgRule(),
    createRule: orgRule(),
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'org', type: 'relation', required: true, collectionId: organizations.id, maxSelect: 1, cascadeDelete: true },
      { name: 'site', type: 'relation', required: false, collectionId: sites.id, maxSelect: 1, cascadeDelete: true },
      { name: 'requested_by', type: 'relation', required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: 'format', type: 'select', required: true, maxSelect: 1, values: ['pdf', 'csv'] },
      { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'processing', 'complete', 'failed', 'cancelled'] },
      { name: 'include_all_sites', type: 'bool' },
      { name: 'sections', type: 'json' },
      { name: 'progress', type: 'number', min: 0, max: 100 },
      { name: 'progress_label', type: 'text', max: 500 },
      { name: 'error_message', type: 'text', max: 4000 },
      { name: 'artifact', type: 'file', maxSelect: 1, maxSize: 1024 * 1024 * 40 },
      { name: 'artifact_name', type: 'text', max: 255 },
      { name: 'started_at', type: 'date' },
      { name: 'completed_at', type: 'date' },
      { name: 'latest_scan_at', type: 'date' }
    ],
    indexes: [
      'CREATE INDEX idx_report_jobs_org ON report_jobs (org)',
      'CREATE INDEX idx_report_jobs_status ON report_jobs (status)',
      'CREATE INDEX idx_report_jobs_site ON report_jobs (site)'
    ]
  })
  app.save(reportJobs)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('report_jobs'))
  } catch (_) {}
})
