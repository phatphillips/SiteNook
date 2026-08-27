/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('content_duplicate_clusters')

  const siteField = collection.fields.getByName('site')
  if (siteField) {
    siteField.required = false
  }

  const scanField = collection.fields.getByName('scan')
  if (scanField) {
    scanField.required = false
  }

  if (!collection.fields.getByName('scope')) {
    collection.fields.add(new Field({
      name: 'scope',
      type: 'select',
      required: true,
      maxSelect: 1,
      values: ['site', 'cross_site']
    }))
  }

  app.save(collection)

  // Backfill existing rows as site-scoped
  try {
    const rows = app.findRecordsByFilter(
      'content_duplicate_clusters',
      'scope = "" || scope = null',
      '',
      500,
      0
    )
    for (const row of rows) {
      row.set('scope', 'site')
      app.save(row)
    }
  } catch (_) {
    // older PB filter quirks — ignore; new writes always set scope
  }

  try {
    const collection2 = app.findCollectionByNameOrId('content_duplicate_clusters')
    const indexes = collection2.indexes || []
    const hasScopeIdx = indexes.some((idx) => String(idx).includes('idx_content_dup_clusters_scope'))
    if (!hasScopeIdx) {
      collection2.indexes = [
        ...indexes,
        'CREATE INDEX idx_content_dup_clusters_scope ON content_duplicate_clusters (organization, scope)'
      ]
      app.save(collection2)
    }
  } catch (_) {}
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('content_duplicate_clusters')
    try {
      collection.fields.removeByName('scope')
    } catch (_) {}
    const siteField = collection.fields.getByName('site')
    if (siteField) siteField.required = true
    const scanField = collection.fields.getByName('scan')
    if (scanField) scanField.required = true
    app.save(collection)
  } catch (_) {}
})
