/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')

  const pagesCollection = app.findCollectionByNameOrId('pages')
  if (!pagesCollection.fields.getByName('seo_snapshot')) {
    pagesCollection.fields.add(new Field({
      name: 'seo_snapshot',
      type: 'json',
      maxSize: 8192
    }))
    app.save(pagesCollection)
  }

  const scansCollection = app.findCollectionByNameOrId('scans')
  const scanTypeField = scansCollection.fields.getByName('scan_type')
  if (scanTypeField) {
    scanTypeField.values = ['full', 'accessibility_only', 'qa_only', 'seo_only']
    app.save(scansCollection)
  }

  for (const name of ['score_seo', 'score_seo_technical', 'score_seo_content']) {
    if (!scansCollection.fields.getByName(name)) {
      scansCollection.fields.add(new Field({
        name,
        type: 'number',
        min: 0,
        max: 100
      }))
    }
  }
  app.save(scansCollection)

  const queueCollection = app.findCollectionByNameOrId('scan_queue')
  const queueScanType = queueCollection.fields.getByName('scan_type')
  if (queueScanType) {
    queueScanType.values = ['full', 'accessibility_only', 'qa_only', 'seo_only']
    app.save(queueCollection)
  }

  const seoIssues = new Collection({
    name: 'seo_issues',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    fields: [
      {
        name: 'scan',
        type: 'relation',
        required: true,
        collectionId: scans.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'site',
        type: 'relation',
        required: true,
        collectionId: sites.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'page',
        type: 'relation',
        collectionId: pages.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'rule_id', type: 'text', required: true },
      {
        name: 'category',
        type: 'select',
        values: ['technical', 'content'],
        maxSelect: 1,
        required: true
      },
      {
        name: 'subcategory',
        type: 'select',
        values: ['on_page', 'crawlability', 'structured_data', 'content_quality', 'duplicates'],
        maxSelect: 1
      },
      {
        name: 'severity',
        type: 'select',
        values: ['critical', 'serious', 'moderate', 'minor'],
        maxSelect: 1,
        required: true
      },
      {
        name: 'status',
        type: 'select',
        values: ['open', 'dismissed', 'fixed'],
        maxSelect: 1
      },
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'recommendation', type: 'text' },
      { name: 'current_value', type: 'text' },
      { name: 'expected_value', type: 'text' },
      { name: 'evidence', type: 'json' },
      {
        name: 'dismissed_by',
        type: 'relation',
        collectionId: users.id,
        maxSelect: 1
      },
      { name: 'dismissed_at', type: 'date' },
      { name: 'dismiss_reason', type: 'text' }
    ]
  })

  app.save(seoIssues)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('seo_issues'))
  } catch (_) {}

  const scansCollection = app.findCollectionByNameOrId('scans')
  for (const name of ['score_seo', 'score_seo_technical', 'score_seo_content']) {
    try {
      scansCollection.fields.removeByName(name)
    } catch (_) {}
  }
  app.save(scansCollection)

  const pagesCollection = app.findCollectionByNameOrId('pages')
  try {
    pagesCollection.fields.removeByName('seo_snapshot')
    app.save(pagesCollection)
  } catch (_) {}
})
