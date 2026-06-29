/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')

  if (!scans.fields.getByName('score_best_practices')) {
    scans.fields.add(new NumberField({
      name: 'score_best_practices',
      required: false,
      min: 0,
      max: 100
    }))
  }

  app.save(scans)
}, (app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const field = scans.fields.getByName('score_best_practices')
  if (field) scans.fields.removeById(field.id)
  app.save(scans)
})
