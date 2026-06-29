/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  if (!sites.fields.getByName('schedule_next_run_at')) {
    sites.fields.add(new Field({ name: 'schedule_next_run_at', type: 'date' }))
  }
  if (!sites.fields.getByName('schedule_last_enqueued_at')) {
    sites.fields.add(new Field({ name: 'schedule_last_enqueued_at', type: 'date' }))
  }
  app.save(sites)
}, (app) => {
  const sites = app.findCollectionByNameOrId('sites')
  sites.fields.removeByName('schedule_next_run_at')
  sites.fields.removeByName('schedule_last_enqueued_at')
  app.save(sites)
})
