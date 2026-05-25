/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const sites = app.findCollectionByNameOrId('sites')

  const collection = new Collection({
    name: 'pages',
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
      {
        name: 'site',
        type: 'relation',
        required: true,
        collectionId: sites.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'url', type: 'url', required: true },
      { name: 'title', type: 'text' },
      { name: 'status_code', type: 'number' },
      { name: 'last_modified', type: 'date' },
      { name: 'word_count', type: 'number', min: 0 },
      { name: 'readability_score', type: 'number' },
      { name: 'crawl_depth', type: 'number', min: 0 },
      { name: 'html_snapshot', type: 'text', max: 500000 }
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pages')
  app.delete(collection)
})
