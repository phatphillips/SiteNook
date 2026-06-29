/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const pages = app.findCollectionByNameOrId('pages')
  if (!pages.fields.getByName('readability_scores')) {
    pages.fields.add(new Field({ name: 'readability_scores', type: 'json' }))
    app.save(pages)
  }
}, (app) => {
  const pages = app.findCollectionByNameOrId('pages')
  if (pages.fields.getByName('readability_scores')) {
    pages.fields.removeByName('readability_scores')
    app.save(pages)
  }
})
