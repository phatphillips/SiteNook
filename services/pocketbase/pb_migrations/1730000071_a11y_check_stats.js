/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  if (!scans.fields.getByName('a11y_check_stats')) {
    scans.fields.add(new JSONField({ name: 'a11y_check_stats' }))
  }
  app.save(scans)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const field = scans.fields.getByName('a11y_check_stats')
  if (field) scans.fields.removeById(field.id)
  app.save(scans)
})
