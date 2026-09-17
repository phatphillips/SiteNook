/// <reference path="../pb_data/types.d.ts" />

/**
 * PocketBase 0.22+ no longer auto-adds created/updated on base collections.
 * Client/scanner sort=-created / sort=-updated returns 400 without these fields
 * (same pattern as 1730000057_pdf_remediation_autodate).
 */
migrate((app) => {
  const names = ['pdf_documents', 'scan_queue', 'pdf_validation_queue', 'pdf_issues']
  for (const name of names) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      let dirty = false
      if (!collection.fields.getByName('created')) {
        collection.fields.add(new AutodateField({
          name: 'created',
          onCreate: true,
          onUpdate: false
        }))
        dirty = true
      }
      if (!collection.fields.getByName('updated')) {
        collection.fields.add(new AutodateField({
          name: 'updated',
          onCreate: true,
          onUpdate: true
        }))
        dirty = true
      }
      if (dirty) app.save(collection)
    } catch (_) {}
  }
}, (app) => {
  for (const name of ['pdf_documents', 'scan_queue', 'pdf_validation_queue', 'pdf_issues']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      collection.fields.removeByName('created')
      collection.fields.removeByName('updated')
      app.save(collection)
    } catch (_) {}
  }
})
