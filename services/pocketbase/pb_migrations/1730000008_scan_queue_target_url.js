/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('scan_queue')

  if (!collection.fields.getByName('target_url')) {
    collection.fields.add(new Field({
      name: 'target_url',
      type: 'url'
    }))
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('scan_queue')
  collection.fields.removeByName('target_url')
  app.save(collection)
})
