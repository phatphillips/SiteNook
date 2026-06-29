/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')

  if (!pdfDocuments.fields.getByName('pdf_metadata')) {
    pdfDocuments.fields.add(new Field({
      name: 'pdf_metadata',
      type: 'json',
      maxSize: 65536
    }))
  }

  if (!pdfDocuments.fields.getByName('text_content')) {
    pdfDocuments.fields.add(new Field({
      name: 'text_content',
      type: 'text',
      maxSize: 500000
    }))
  }

  app.save(pdfDocuments)
}, (app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')

  const metadataField = pdfDocuments.fields.getByName('pdf_metadata')
  if (metadataField) {
    pdfDocuments.fields.removeById(metadataField.id)
  }

  const textField = pdfDocuments.fields.getByName('text_content')
  if (textField) {
    pdfDocuments.fields.removeById(textField.id)
  }

  app.save(pdfDocuments)
})
