/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('qa_inventory')
  collection.fields.add(new SelectField({
    name: 'asset_category',
    values: ['image', 'file', 'pdf'],
    maxSelect: 1
  }))
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('qa_inventory')
  collection.fields.removeByName('asset_category')
  app.save(collection)
})
