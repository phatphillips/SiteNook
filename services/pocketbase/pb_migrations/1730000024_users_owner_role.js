/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    const users = app.findCollectionByNameOrId('users')
    const roleField = users.fields.getByName('role')
    if (!roleField) return

    const values = [...(roleField.values || [])]
    if (!values.includes('owner')) {
      values.unshift('owner')
      roleField.values = values
      app.save(users)
    }
  } catch (_) {}
}, () => {})
