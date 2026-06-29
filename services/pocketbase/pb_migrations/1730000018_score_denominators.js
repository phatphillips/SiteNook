/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  if (!sites.fields.getByName('score_denominators')) {
    sites.fields.add(new Field({ name: 'score_denominators', type: 'json' }))
    app.save(sites)
  }

  const scans = app.findCollectionByNameOrId('scans')
  if (!scans.fields.getByName('score_denominators')) {
    scans.fields.add(new Field({ name: 'score_denominators', type: 'json' }))
    app.save(scans)
  }
}, (app) => {
  const sites = app.findCollectionByNameOrId('sites')
  if (sites.fields.getByName('score_denominators')) {
    sites.fields.removeByName('score_denominators')
    app.save(sites)
  }

  const scans = app.findCollectionByNameOrId('scans')
  if (scans.fields.getByName('score_denominators')) {
    scans.fields.removeByName('score_denominators')
    app.save(scans)
  }
})
