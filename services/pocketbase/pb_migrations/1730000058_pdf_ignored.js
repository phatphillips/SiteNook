/// <reference path="../pb_data/types.d.ts" />

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  addFieldIfMissing(pdfDocuments, {
    name: 'ignored',
    type: 'bool'
  })
  addFieldIfMissing(pdfDocuments, {
    name: 'ignored_at',
    type: 'date'
  })
  app.save(pdfDocuments)
}, (app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  ;['ignored', 'ignored_at'].forEach((name) => {
    const field = pdfDocuments.fields.getByName(name)
    if (field) pdfDocuments.fields.removeById(field.id)
  })
  app.save(pdfDocuments)
})
