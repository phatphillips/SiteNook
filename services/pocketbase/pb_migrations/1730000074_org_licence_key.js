/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  if (!organizations.fields.getByName('licence_key')) {
    organizations.fields.add(new TextField({
      name: 'licence_key',
      required: false,
      max: 200
    }))
    app.save(organizations)
  }
}, (app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  if (organizations.fields.getByName('licence_key')) {
    organizations.fields.removeByName('licence_key')
    app.save(organizations)
  }
})
