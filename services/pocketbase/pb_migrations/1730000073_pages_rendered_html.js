/// <reference path="../pb_data/types.d.ts" />

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const pages = app.findCollectionByNameOrId('pages')

  addFieldIfMissing(pages, {
    name: 'rendered_html',
    type: 'file',
    maxSelect: 1,
    maxSize: 8 * 1024 * 1024,
    mimeTypes: ['text/html']
  })

  app.save(pages)
}, (app) => {
  const pages = app.findCollectionByNameOrId('pages')

  const renderedHtml = pages.fields.getByName('rendered_html')
  if (renderedHtml) pages.fields.removeById(renderedHtml.id)

  app.save(pages)
})
