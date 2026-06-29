/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const planField = organizations.fields.getByName('plan')
  if (planField) {
    planField.values = ['free', 'starter', 'team', 'business', 'enterprise']
    app.save(organizations)

    const records = app.findRecordsByFilter('organizations', 'plan = "standard"')
    for (const record of records) {
      record.set('plan', 'team')
      app.save(record)
    }
  }

  try {
    const checkoutSessions = app.findCollectionByNameOrId('stripe_checkout_sessions')
    const checkoutPlanField = checkoutSessions.fields.getByName('plan')
    if (checkoutPlanField) {
      checkoutPlanField.values = ['free', 'starter', 'team', 'business', 'enterprise']
      app.save(checkoutSessions)

      const sessions = app.findRecordsByFilter('stripe_checkout_sessions', 'plan = "standard"')
      for (const session of sessions) {
        session.set('plan', 'team')
        app.save(session)
      }
    }
  } catch (_) {
    // collection may not exist on very old databases
  }
}, (app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const planField = organizations.fields.getByName('plan')
  if (planField) {
    const records = app.findRecordsByFilter('organizations', 'plan = "team"')
    for (const record of records) {
      record.set('plan', 'standard')
      app.save(record)
    }

    planField.values = ['free', 'standard', 'enterprise']
    app.save(organizations)
  }

  try {
    const checkoutSessions = app.findCollectionByNameOrId('stripe_checkout_sessions')
    const checkoutPlanField = checkoutSessions.fields.getByName('plan')
    if (checkoutPlanField) {
      const sessions = app.findRecordsByFilter('stripe_checkout_sessions', 'plan = "team"')
      for (const session of sessions) {
        session.set('plan', 'standard')
        app.save(session)
      }
      checkoutPlanField.values = ['free', 'standard', 'enterprise']
      app.save(checkoutSessions)
    }
  } catch (_) {}
})
