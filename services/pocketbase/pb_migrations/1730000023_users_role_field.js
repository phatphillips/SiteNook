/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  if (!users.fields.getByName('role')) {
    users.fields.add(new Field({
      name: 'role',
      type: 'select',
      values: ['admin', 'analyst', 'viewer'],
      maxSelect: 1
    }))
    app.save(users)
  }
}, () => {})
