/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')

  const collection = new Collection({
    name: 'scan_queue',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'site',
        type: 'relation',
        required: true,
        collectionId: sites.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'priority', type: 'number', min: 0 },
      {
        name: 'requested_by',
        type: 'relation',
        collectionId: users.id,
        maxSelect: 1
      },
      {
        name: 'scan_type',
        type: 'select',
        values: ['full', 'accessibility_only', 'qa_only'],
        maxSelect: 1
      },
      {
        name: 'status',
        type: 'select',
        values: ['pending', 'processing', 'complete', 'failed'],
        maxSelect: 1
      }
    ]
  })

  app.save(collection)

  const usersCollection = app.findCollectionByNameOrId('users')
  if (!usersCollection.fields.getByName('role')) {
    usersCollection.fields.add(new Field({
      name: 'role',
      type: 'select',
      values: ['admin', 'analyst', 'viewer'],
      maxSelect: 1
    }))
    app.save(usersCollection)
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('scan_queue'))
  } catch (_) {}
})
