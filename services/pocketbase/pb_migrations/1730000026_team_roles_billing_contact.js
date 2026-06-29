/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const organizations = app.findCollectionByNameOrId('organizations')

  const roleField = users.fields.getByName('role')
  if (roleField) {
    roleField.values = ['admin', 'viewer']
    app.save(users)
  }

  if (!users.fields.getByName('is_billing_contact')) {
    users.fields.add(new Field({
      name: 'is_billing_contact',
      type: 'bool',
      required: false
    }))
    app.save(users)
  }

  const allUsers = app.findAllRecords('users')
  for (const user of allUsers) {
    const role = String(user.get('role') || '')
    let changed = false

    if (role === 'owner') {
      user.set('role', 'admin')
      user.set('is_billing_contact', true)
      changed = true
    } else if (role === 'analyst') {
      user.set('role', 'viewer')
      changed = true
    } else if (role === 'admin') {
      if (user.get('is_billing_contact') == null) {
        user.set('is_billing_contact', false)
        changed = true
      }
    } else if (role === 'viewer') {
      if (user.get('is_billing_contact') == null) {
        user.set('is_billing_contact', false)
        changed = true
      }
    }

    if (changed) {
      app.save(user)
    }
  }

  let teamActivityExists = false
  try {
    app.findCollectionByNameOrId('team_activity_log')
    teamActivityExists = true
  } catch (_) {}

  if (!teamActivityExists) {
  const collection = new Collection({
    name: 'team_activity_log',
    type: 'base',
    listRule: 'organization = @request.auth.organization',
    viewRule: 'organization = @request.auth.organization',
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
        name: 'actor',
        type: 'relation',
        required: false,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false
      },
      {
        name: 'target',
        type: 'relation',
        required: false,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false
      },
      {
        name: 'action',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: [
          'member_added',
          'member_removed',
          'role_changed',
          'billing_contact_added',
          'billing_contact_removed',
          'invite_resent'
        ]
      },
      {
        name: 'details',
        type: 'json'
      }
    ],
    indexes: [
      'CREATE INDEX idx_team_activity_org ON team_activity_log (organization)'
    ]
  })

  app.save(collection)
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('team_activity_log')
    app.delete(collection)
  } catch (_) {}
})
