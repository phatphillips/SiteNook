/// <reference path="../pb_data/types.d.ts" />

const USERS_CREATE_RULE =
  '@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.role = "owner") && organization = @request.auth.organization'

migrate((app) => {
  try {
    const users = app.findCollectionByNameOrId('users')
    users.createRule = USERS_CREATE_RULE
    app.save(users)
  } catch (_) {}
}, () => {})
