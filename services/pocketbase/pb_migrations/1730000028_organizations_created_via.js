/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')

  if (!organizations.fields.getByName('created_via')) {
    organizations.fields.add(new Field({
      name: 'created_via',
      type: 'select',
      values: ['self_service', 'provision_api'],
      maxSelect: 1
    }))
    app.save(organizations)
  }
}, (app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const field = organizations.fields.getByName('created_via')
  if (field) {
    organizations.fields.removeById(field.id)
    app.save(organizations)
  }
})
