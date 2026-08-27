/// <reference path="../pb_data/types.d.ts" />

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  addFieldIfMissing(pdfDocuments, {
    name: 'content_hash',
    type: 'text'
  })

  const indexes = pdfDocuments.indexes || []
  if (!indexes.some((idx) => String(idx).includes('content_hash'))) {
    indexes.push('CREATE INDEX idx_pdf_documents_content_hash ON pdf_documents (content_hash)')
  }
  if (!indexes.some((idx) => String(idx).includes('site_url'))) {
    indexes.push('CREATE INDEX idx_pdf_documents_site_url ON pdf_documents (site, url)')
  }
  pdfDocuments.indexes = indexes
  app.save(pdfDocuments)
}, (app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  const field = pdfDocuments.fields.getByName('content_hash')
  if (field) pdfDocuments.fields.removeById(field.id)
  pdfDocuments.indexes = (pdfDocuments.indexes || []).filter(
    (idx) => !String(idx).includes('content_hash') && !String(idx).includes('site_url')
  )
  app.save(pdfDocuments)
})
