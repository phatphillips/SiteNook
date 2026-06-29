/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')
  const inventory = app.findCollectionByNameOrId('qa_inventory')

  const pdfDocuments = new Collection({
    name: 'pdf_documents',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    fields: [
      {
        name: 'site',
        type: 'relation',
        required: true,
        collectionId: sites.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'source',
        type: 'select',
        values: ['upload', 'crawl'],
        maxSelect: 1,
        required: true
      },
      {
        name: 'file',
        type: 'file',
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: ['application/pdf']
      },
      { name: 'url', type: 'url' },
      {
        name: 'inventory',
        type: 'relation',
        collectionId: inventory.id,
        maxSelect: 1,
        cascadeDelete: false
      },
      { name: 'filename', type: 'text' },
      { name: 'document_title', type: 'text' },
      {
        name: 'status',
        type: 'select',
        values: ['pending', 'processing', 'complete', 'failed'],
        maxSelect: 1
      },
      { name: 'machine_readable', type: 'bool' },
      { name: 'has_pdf_tags', type: 'bool' },
      { name: 'issue_count', type: 'number', min: 0 },
      { name: 'accessibility_score', type: 'number', min: 0, max: 100 },
      { name: 'share_token', type: 'text' },
      {
        name: 'uploaded_by',
        type: 'relation',
        collectionId: users.id,
        maxSelect: 1
      },
      { name: 'validated_at', type: 'date' },
      { name: 'error_message', type: 'text' },
      { name: 'report_summary', type: 'json', maxSize: 65536 }
    ]
  })

  const pdfIssues = new Collection({
    name: 'pdf_issues',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'pdf_document',
        type: 'relation',
        required: true,
        collectionId: pdfDocuments.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'category',
        type: 'select',
        values: ['document', 'element'],
        maxSelect: 1,
        required: true
      },
      { name: 'rule_id', type: 'text', required: true },
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      {
        name: 'severity',
        type: 'select',
        values: ['critical', 'serious', 'moderate', 'minor'],
        maxSelect: 1,
        required: true
      },
      { name: 'page_number', type: 'number', min: 1 },
      { name: 'occurrence_count', type: 'number', min: 1 },
      { name: 'evidence', type: 'json', maxSize: 8192 }
    ]
  })

  const pdfValidationQueue = new Collection({
    name: 'pdf_validation_queue',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.id != ""',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'pdf_document',
        type: 'relation',
        required: true,
        collectionId: pdfDocuments.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'status',
        type: 'select',
        values: ['pending', 'processing', 'complete', 'failed', 'cancelled'],
        maxSelect: 1
      },
      { name: 'priority', type: 'number' },
      { name: 'error_message', type: 'text' }
    ]
  })

  app.save(pdfDocuments)
  app.save(pdfIssues)
  app.save(pdfValidationQueue)
}, (app) => {
  for (const name of ['pdf_validation_queue', 'pdf_issues', 'pdf_documents']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
