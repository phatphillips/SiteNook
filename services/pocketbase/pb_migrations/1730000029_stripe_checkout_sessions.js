/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let exists = false
  try {
    app.findCollectionByNameOrId('stripe_checkout_sessions')
    exists = true
  } catch (_) {}

  if (exists) return

  const organizations = app.findCollectionByNameOrId('organizations')

  const collection = new Collection({
    name: 'stripe_checkout_sessions',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'session_id',
        type: 'text',
        required: true,
        min: 8,
        max: 255
      },
      {
        name: 'plan',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['free', 'standard', 'enterprise']
      },
      {
        name: 'customer_email',
        type: 'text',
        required: false,
        max: 255
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['paid', 'consumed', 'expired']
      },
      {
        name: 'paid_at',
        type: 'date',
        required: true
      },
      {
        name: 'expires_at',
        type: 'date',
        required: true
      },
      {
        name: 'stripe_customer_id',
        type: 'text',
        required: false,
        max: 255
      },
      {
        name: 'stripe_subscription_id',
        type: 'text',
        required: false,
        max: 255
      },
      {
        name: 'organization',
        type: 'relation',
        required: false,
        collectionId: organizations.id,
        maxSelect: 1,
        cascadeDelete: false
      }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_stripe_checkout_session_id ON stripe_checkout_sessions (session_id)'
    ]
  })

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('stripe_checkout_sessions')
    app.delete(collection)
  } catch (_) {}
})
