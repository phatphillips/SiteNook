/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  scans.fields.add(new Field({
    name: 'a11y_summary',
    type: 'json'
  }))
  app.save(scans)

  const sites = app.findCollectionByNameOrId('sites')
  sites.fields.add(new Field({
    name: 'current_a11y',
    type: 'json'
  }))
  app.save(sites)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  scans.fields.removeByName('a11y_summary')
  app.save(scans)

  const sites = app.findCollectionByNameOrId('sites')
  sites.fields.removeByName('current_a11y')
  app.save(sites)
})
