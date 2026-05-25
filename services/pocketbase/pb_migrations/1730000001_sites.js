/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const collection = new Collection({
    name: 'sites',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'url', type: 'url', required: true },
      { name: 'description', type: 'text' },
      {
        name: 'owner',
        type: 'relation',
        required: true,
        collectionId: users.id,
        maxSelect: 1
      },
      {
        name: 'crawl_schedule',
        type: 'select',
        values: ['daily', 'weekly', 'manual'],
        maxSelect: 1
      },
      { name: 'custom_headers', type: 'json' },
      { name: 'auth_config', type: 'json' }
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('sites')
  app.delete(collection)
})
