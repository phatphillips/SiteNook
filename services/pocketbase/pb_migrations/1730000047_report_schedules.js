/// <reference path="../pb_data/types.d.ts" />

function orgRule() {
  return 'org = @request.auth.organization'
}

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')
  const reportJobs = app.findCollectionByNameOrId('report_jobs')

  const reportSchedules = new Collection({
    name: 'report_schedules',
    type: 'base',
    listRule: orgRule(),
    viewRule: orgRule(),
    createRule: orgRule(),
    updateRule: orgRule(),
    deleteRule: orgRule(),
    fields: [
      { name: 'org', type: 'relation', required: true, collectionId: organizations.id, maxSelect: 1, cascadeDelete: true },
      { name: 'site', type: 'relation', required: false, collectionId: sites.id, maxSelect: 1, cascadeDelete: true },
      { name: 'created_by', type: 'relation', required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: 'name', type: 'text', required: true, max: 200 },
      { name: 'format', type: 'select', required: true, maxSelect: 1, values: ['pdf', 'csv'] },
      { name: 'include_all_sites', type: 'bool' },
      { name: 'sections', type: 'json' },
      {
        name: 'cadence',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['once', 'daily', 'weekly', 'monthly', 'every_5d']
      },
      { name: 'run_at', type: 'date' },
      { name: 'schedule_time', type: 'text', max: 8 },
      { name: 'timezone', type: 'text', max: 80 },
      { name: 'next_run_at', type: 'date' },
      { name: 'last_run_at', type: 'date' },
      { name: 'recipient_ids', type: 'json' },
      { name: 'enabled', type: 'bool' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: [
      'CREATE INDEX idx_report_schedules_org ON report_schedules (org)',
      'CREATE INDEX idx_report_schedules_next_run ON report_schedules (next_run_at)',
      'CREATE INDEX idx_report_schedules_enabled ON report_schedules (enabled)'
    ]
  })
  app.save(reportSchedules)

  if (!reportJobs.fields.getByName('schedule')) {
    reportJobs.fields.add(new Field({
      name: 'schedule',
      type: 'relation',
      required: false,
      collectionId: reportSchedules.id,
      maxSelect: 1,
      cascadeDelete: false
    }))
  }
  if (!reportJobs.fields.getByName('share_token')) {
    reportJobs.fields.add(new Field({
      name: 'share_token',
      type: 'text',
      required: false,
      max: 64
    }))
  }
  if (!reportJobs.fields.getByName('share_expires_at')) {
    reportJobs.fields.add(new Field({
      name: 'share_expires_at',
      type: 'date'
    }))
  }

  const jobIndexes = reportJobs.indexes || []
  const hasShareIndex = jobIndexes.some((idx) => String(idx).includes('share_token'))
  const hasScheduleIndex = jobIndexes.some((idx) => String(idx).includes('report_jobs_schedule'))
  if (!hasShareIndex) {
    // Non-partial unique index — empty share_token values are rare for scheduled jobs;
    // one-shot jobs leave share_token blank and SQLite allows multiple NULLs/empty depending on column,
    // but PocketBase text fields store "" — use a plain index to avoid migration failures.
    jobIndexes.push('CREATE INDEX idx_report_jobs_share_token ON report_jobs (share_token)')
  }
  if (!hasScheduleIndex) {
    jobIndexes.push('CREATE INDEX idx_report_jobs_schedule ON report_jobs (schedule)')
  }
  reportJobs.indexes = jobIndexes
  app.save(reportJobs)

  if (!reportSchedules.fields.getByName('last_job')) {
    reportSchedules.fields.add(new Field({
      name: 'last_job',
      type: 'relation',
      required: false,
      collectionId: reportJobs.id,
      maxSelect: 1,
      cascadeDelete: false
    }))
    app.save(reportSchedules)
  }
}, (app) => {
  try {
    const reportJobs = app.findCollectionByNameOrId('report_jobs')
    reportJobs.fields.removeByName('schedule')
    reportJobs.fields.removeByName('share_token')
    reportJobs.fields.removeByName('share_expires_at')
    reportJobs.indexes = (reportJobs.indexes || []).filter(
      (idx) => !String(idx).includes('share_token') && !String(idx).includes('report_jobs_schedule')
    )
    app.save(reportJobs)
  } catch (_) {}

  try {
    app.delete(app.findCollectionByNameOrId('report_schedules'))
  } catch (_) {}
})
