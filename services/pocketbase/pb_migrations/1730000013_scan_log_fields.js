/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')

  scans.fields.add(new TextField({
    name: 'error_message',
    max: 500
  }))

  scans.fields.add(new NumberField({
    name: 'open_issue_count',
    min: 0
  }))

  app.save(scans)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  scans.fields.removeByName('error_message')
  scans.fields.removeByName('open_issue_count')
  app.save(scans)
})
