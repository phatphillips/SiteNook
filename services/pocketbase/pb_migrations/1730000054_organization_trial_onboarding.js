/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')

  if (!organizations.fields.getByName('trial_ends_at')) {
    organizations.fields.add(new Field({
      name: 'trial_ends_at',
      type: 'date',
      required: false
    }))
  }

  if (!organizations.fields.getByName('trial_nudge_stage')) {
    organizations.fields.add(new Field({
      name: 'trial_nudge_stage',
      type: 'number',
      required: false
    }))
  }

  if (!organizations.fields.getByName('onboarding_state')) {
    organizations.fields.add(new Field({
      name: 'onboarding_state',
      type: 'json',
      required: false
    }))
  }

  app.save(organizations)
}, (app) => {
  const organizations = app.findCollectionByNameOrId('organizations')

  for (const name of ['trial_ends_at', 'trial_nudge_stage', 'onboarding_state']) {
    const field = organizations.fields.getByName(name)
    if (field) {
      organizations.fields.removeById(field.id)
    }
  }

  app.save(organizations)
})
