/// <reference path="../pb_data/types.d.ts" />

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const pages = app.findCollectionByNameOrId('pages')

  addFieldIfMissing(pages, {
    name: 'preview_image',
    type: 'file',
    maxSelect: 1,
    maxSize: 8 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  })
  addFieldIfMissing(pages, {
    name: 'tab_order',
    type: 'json',
    maxSize: 512000
  })

  app.save(pages)
}, (app) => {
  const pages = app.findCollectionByNameOrId('pages')

  const previewImage = pages.fields.getByName('preview_image')
  if (previewImage) pages.fields.removeById(previewImage.id)

  const tabOrder = pages.fields.getByName('tab_order')
  if (tabOrder) pages.fields.removeById(tabOrder.id)

  app.save(pages)
})
