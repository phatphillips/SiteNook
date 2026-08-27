/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')

  scans.fields.add(new NumberField({
    name: 'broken_link_count',
    min: 0
  }))

  app.save(scans)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  scans.fields.removeByName('broken_link_count')
  app.save(scans)
})
