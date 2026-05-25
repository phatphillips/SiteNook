/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')

  const collection = new Collection({
    name: 'scans',
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
        name: 'status',
        type: 'select',
        values: ['queued', 'running', 'complete', 'failed'],
        maxSelect: 1
      },
      {
        name: 'scan_type',
        type: 'select',
        values: ['full', 'accessibility_only', 'qa_only'],
        maxSelect: 1
      },
      { name: 'pages_crawled', type: 'number', min: 0 },
      { name: 'started_at', type: 'date' },
      { name: 'completed_at', type: 'date' },
      {
        name: 'wcag_version',
        type: 'select',
        values: ['2.1', '2.2'],
        maxSelect: 1
      },
      { name: 'score_a', type: 'number', min: 0, max: 100 },
      { name: 'score_aa', type: 'number', min: 0, max: 100 },
      { name: 'score_aaa', type: 'number', min: 0, max: 100 },
      { name: 'score_qa', type: 'number', min: 0, max: 100 },
      { name: 'raw_config', type: 'json' },
      { name: 'diff_summary', type: 'json' }
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('scans')
  app.delete(collection)
})
