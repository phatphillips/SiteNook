/// <reference path="../pb_data/types.d.ts" />

/**
 * Org-scoped API keys for optional MCP / agent access.
 * Secrets are stored hashed; plaintext is shown once at creation via Nitro.
 * Collection is server-only (empty API rules); mutations go through Nitro + admin client.
 */
migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const users = app.findCollectionByNameOrId('users')

  let exists = false
  try {
    app.findCollectionByNameOrId('api_keys')
    exists = true
  } catch (_) {}

  if (exists) return

  const collection = new Collection({
    name: 'api_keys',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'organization',
        type: 'relation',
        required: true,
        collectionId: organizations.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'name',
        type: 'text',
        required: true,
        max: 120
      },
      {
        name: 'key_prefix',
        type: 'text',
        required: true,
        max: 16
      },
      {
        name: 'key_hash',
        type: 'text',
        required: true,
        max: 128
      },
      {
        name: 'scopes',
        type: 'select',
        required: true,
        maxSelect: 2,
        values: ['read', 'write']
      },
      {
        name: 'created_by',
        type: 'relation',
        required: false,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false
      },
      {
        name: 'last_used_at',
        type: 'date',
        required: false
      },
      {
        name: 'revoked_at',
        type: 'date',
        required: false
      }
    ],
    indexes: [
      'CREATE INDEX idx_api_keys_org ON api_keys (organization)',
      'CREATE INDEX idx_api_keys_prefix ON api_keys (key_prefix)',
      'CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash)'
    ]
  })
  app.save(collection)

  if (!collection.fields.getByName('created')) {
    collection.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!collection.fields.getByName('updated')) {
    collection.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(collection)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('api_keys'))
  } catch (_) {}
})
