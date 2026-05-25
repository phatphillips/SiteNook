/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')

  const brokenLinks = new Collection({
    name: 'qa_broken_links',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '@request.auth.id != ""',
    deleteRule: '',
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
        name: 'page',
        type: 'relation',
        required: true,
        collectionId: pages.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'href', type: 'url', required: true },
      { name: 'status_code', type: 'number' },
      {
        name: 'link_type',
        type: 'select',
        values: ['internal', 'external'],
        maxSelect: 1
      },
      {
        name: 'status',
        type: 'select',
        values: ['broken', 'redirected', 'dismissed'],
        maxSelect: 1
      }
    ]
  })

  const spelling = new Collection({
    name: 'qa_spelling',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '@request.auth.id != ""',
    deleteRule: '',
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
        name: 'page',
        type: 'relation',
        required: true,
        collectionId: pages.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'word', type: 'text', required: true },
      { name: 'context', type: 'text' },
      {
        name: 'confidence',
        type: 'select',
        values: ['error', 'review'],
        maxSelect: 1
      },
      {
        name: 'status',
        type: 'select',
        values: ['open', 'dismissed', 'false_positive'],
        maxSelect: 1
      }
    ]
  })

  const inventory = new Collection({
    name: 'qa_inventory',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'scan',
        type: 'relation',
        required: true,
        collectionId: scans.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'url', type: 'url', required: true },
      { name: 'content_type', type: 'text' },
      { name: 'size_bytes', type: 'number', min: 0 },
      { name: 'mime_type', type: 'text' },
      { name: 'is_pdf', type: 'bool' },
      { name: 'pdf_accessibility_score', type: 'number', min: 0, max: 100 }
    ]
  })

  app.save(brokenLinks)
  app.save(spelling)
  app.save(inventory)
}, (app) => {
  for (const name of ['qa_broken_links', 'qa_spelling', 'qa_inventory']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
