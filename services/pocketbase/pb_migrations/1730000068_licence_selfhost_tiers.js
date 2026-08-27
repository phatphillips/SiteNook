/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const licences = app.findCollectionByNameOrId('licences')
  const tierField = licences.fields.getByName('tier')
  if (tierField) {
    tierField.values = ['community', 'selfhost', 'enterprise']
    app.save(licences)
  }

  if (!licences.fields.getByName('stripe_subscription_id')) {
    licences.fields.add(new Field({
      name: 'stripe_subscription_id',
      type: 'text',
      required: false,
      max: 255
    }))
  }

  if (!licences.fields.getByName('customer_email')) {
    licences.fields.add(new Field({
      name: 'customer_email',
      type: 'text',
      required: false,
      max: 255
    }))
  }

  if (!licences.fields.getByName('stripe_checkout_session_id')) {
    licences.fields.add(new Field({
      name: 'stripe_checkout_session_id',
      type: 'text',
      required: false,
      max: 255
    }))
  }

  app.save(licences)

  const indexes = licences.indexes || []
  if (!indexes.some((idx) => String(idx).includes('idx_licences_stripe_subscription'))) {
    licences.indexes = [
      ...indexes,
      'CREATE INDEX idx_licences_stripe_subscription ON licences (stripe_subscription_id)',
      'CREATE INDEX idx_licences_checkout_session ON licences (stripe_checkout_session_id)'
    ]
    app.save(licences)
  }
}, (app) => {
  const licences = app.findCollectionByNameOrId('licences')

  const records = app.findRecordsByFilter(
    'licences',
    'tier = "community" || tier = "selfhost"'
  )
  for (const record of records) {
    record.set('tier', 'enterprise')
    app.save(record)
  }

  const tierField = licences.fields.getByName('tier')
  if (tierField) {
    tierField.values = ['enterprise']
  }

  for (const name of ['stripe_subscription_id', 'customer_email', 'stripe_checkout_session_id']) {
    const field = licences.fields.getByName(name)
    if (field) {
      licences.fields.removeById(field.id)
    }
  }

  licences.indexes = (licences.indexes || []).filter(
    (idx) => !String(idx).includes('idx_licences_stripe_subscription')
      && !String(idx).includes('idx_licences_checkout_session')
  )
  app.save(licences)
})
