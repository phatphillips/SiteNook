/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let exists = false
  try {
    app.findCollectionByNameOrId('licences')
    exists = true
  } catch (_) {}

  if (exists) return

  const collection = new Collection({
    name: 'licences',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'key',
        type: 'text',
        required: true,
        min: 8,
        max: 128
      },
      {
        name: 'tier',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['enterprise']
      },
      {
        name: 'domain',
        type: 'text',
        required: false,
        max: 255
      },
      {
        name: 'fingerprint',
        type: 'text',
        required: false,
        max: 255
      },
      {
        name: 'expires_at',
        type: 'date',
        required: true
      },
      {
        name: 'revoked',
        type: 'bool',
        required: false
      },
      {
        name: 'notes',
        type: 'text',
        required: false,
        max: 2000
      }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_licences_key ON licences (key)'
    ]
  })

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('licences')
    app.delete(collection)
  } catch (_) {}
})
