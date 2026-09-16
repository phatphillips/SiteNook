/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const sites = app.findCollectionByNameOrId('sites')

  const collection = new Collection({
    name: 'scan_log_events',
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
      {
        name: 'level',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['info', 'success', 'warn', 'error']
      },
      { name: 'message', type: 'text', required: true, max: 2000 },
      { name: 'url', type: 'url' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: [
      'CREATE INDEX idx_scan_log_scan ON scan_log_events (scan)',
      'CREATE INDEX idx_scan_log_created ON scan_log_events (created)'
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('scan_log_events')
  app.delete(collection)
})
