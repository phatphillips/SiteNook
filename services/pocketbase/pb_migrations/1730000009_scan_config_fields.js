/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  if (!sites.fields.getByName('default_scan_config')) {
    sites.fields.add(new Field({ name: 'default_scan_config', type: 'json' }))
  }
  const scheduleField = sites.fields.getByName('crawl_schedule')
  if (scheduleField) {
    scheduleField.values = ['manual', 'hourly', 'every_6h', 'daily', 'weekly', 'monthly']
  }
  app.save(sites)

  const scanQueue = app.findCollectionByNameOrId('scan_queue')
  if (!scanQueue.fields.getByName('raw_config')) {
    scanQueue.fields.add(new Field({ name: 'raw_config', type: 'json' }))
  }
  app.save(scanQueue)
}, (app) => {
  const sites = app.findCollectionByNameOrId('sites')
  sites.fields.removeByName('default_scan_config')
  const scheduleField = sites.fields.getByName('crawl_schedule')
  if (scheduleField) {
    scheduleField.values = ['manual', 'daily', 'weekly']
  }
  app.save(sites)

  const scanQueue = app.findCollectionByNameOrId('scan_queue')
  scanQueue.fields.removeByName('raw_config')
  app.save(scanQueue)
})
