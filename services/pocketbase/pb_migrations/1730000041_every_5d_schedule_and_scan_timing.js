/// <reference path="../pb_data/types.d.ts" />

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000

function nextEvery5d(fromDate) {
  const from = fromDate || new Date()
  return new Date(from.getTime() + FIVE_DAYS_MS).toISOString()
}

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const scheduleField = sites.fields.getByName('crawl_schedule')
  if (scheduleField && !scheduleField.values.includes('every_5d')) {
    scheduleField.values = [...scheduleField.values, 'every_5d']
    app.save(sites)
  }

  const scans = app.findCollectionByNameOrId('scans')
  if (!scans.fields.getByName('queued_at')) {
    scans.fields.add(new Field({ name: 'queued_at', type: 'date' }))
  }
  if (!scans.fields.getByName('crawl_finished_at')) {
    scans.fields.add(new Field({ name: 'crawl_finished_at', type: 'date' }))
  }
  app.save(scans)

  const now = new Date()
  const siteRecords = app.findAllRecords('sites')
  for (const record of siteRecords) {
    record.set('crawl_schedule', 'every_5d')
    record.set('schedule_next_run_at', nextEvery5d(now))
    record.set('schedule_last_enqueued_at', null)

    const existingConfig = record.get('default_scan_config')
    if (existingConfig && typeof existingConfig === 'object') {
      const schedule = existingConfig.schedule || {}
      record.set('default_scan_config', {
        ...existingConfig,
        schedule: {
          frequency: 'every_5d',
          time: schedule.time || '14:00',
          timezone: schedule.timezone || 'UTC'
        }
      })
    }

    app.save(record)
  }
}, (app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const scheduleField = sites.fields.getByName('crawl_schedule')
  if (scheduleField) {
    scheduleField.values = scheduleField.values.filter(v => v !== 'every_5d')
    app.save(sites)
  }

  const scans = app.findCollectionByNameOrId('scans')
  scans.fields.removeByName('queued_at')
  scans.fields.removeByName('crawl_finished_at')
  app.save(scans)
})
