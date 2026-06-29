/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const users = app.findCollectionByNameOrId('users')

  if (!organizations.fields.getByName('status')) {
    organizations.fields.add(new Field({
      name: 'status',
      type: 'select',
      required: true,
      maxSelect: 1,
      values: ['active', 'closing']
    }))
  }

  if (!organizations.fields.getByName('stripe_customer_id')) {
    organizations.fields.add(new Field({
      name: 'stripe_customer_id',
      type: 'text',
      required: false,
      max: 255
    }))
  }

  if (!organizations.fields.getByName('stripe_subscription_id')) {
    organizations.fields.add(new Field({
      name: 'stripe_subscription_id',
      type: 'text',
      required: false,
      max: 255
    }))
  }

  if (!organizations.fields.getByName('subscription_status')) {
    organizations.fields.add(new Field({
      name: 'subscription_status',
      type: 'select',
      required: true,
      maxSelect: 1,
      values: ['none', 'active', 'past_due', 'canceled', 'trialing']
    }))
  }

  if (!organizations.fields.getByName('closed_at')) {
    organizations.fields.add(new Field({
      name: 'closed_at',
      type: 'date',
      required: false
    }))
  }

  if (!organizations.fields.getByName('purge_scheduled_at')) {
    organizations.fields.add(new Field({
      name: 'purge_scheduled_at',
      type: 'date',
      required: false
    }))
  }

  if (!organizations.fields.getByName('closed_by')) {
    organizations.fields.add(new Field({
      name: 'closed_by',
      type: 'relation',
      required: false,
      collectionId: users.id,
      maxSelect: 1,
      cascadeDelete: false
    }))
  }

  app.save(organizations)

  // Default new field values on existing org rows
  const allOrgs = app.findAllRecords('organizations')
  for (const org of allOrgs) {
    let changed = false
    if (!org.get('status')) {
      org.set('status', 'active')
      changed = true
    }
    if (!org.get('subscription_status')) {
      org.set('subscription_status', 'none')
      changed = true
    }
    if (changed) {
      app.save(org)
    }
  }

  // Extend team_activity_log action enum
  try {
    const activityLog = app.findCollectionByNameOrId('team_activity_log')
    const actionField = activityLog.fields.getByName('action')
    if (actionField) {
      actionField.values = [
        'member_added',
        'member_removed',
        'role_changed',
        'billing_contact_added',
        'billing_contact_removed',
        'invite_resent',
        'org_closed',
        'subscription_updated'
      ]
      app.save(activityLog)
    }
  } catch (_) {}

  // Backfill Stripe IDs from consumed checkout sessions
  let checkoutCollection = null
  try {
    checkoutCollection = app.findCollectionByNameOrId('stripe_checkout_sessions')
  } catch (_) {}

  if (checkoutCollection) {
    const sessions = app.findRecordsByFilter(
      'stripe_checkout_sessions',
      'organization != "" && (stripe_customer_id != "" || stripe_subscription_id != "")',
      '',
      500,
      0
    )

    for (const session of sessions) {
      const orgId = String(session.get('organization') || '')
      if (!orgId) continue

      let org
      try {
        org = app.findRecordById('organizations', orgId)
      } catch (_) {
        continue
      }

      const customerId = String(session.get('stripe_customer_id') || '').trim()
      const subscriptionId = String(session.get('stripe_subscription_id') || '').trim()
      let changed = false

      if (customerId && !String(org.get('stripe_customer_id') || '').trim()) {
        org.set('stripe_customer_id', customerId)
        changed = true
      }
      if (subscriptionId && !String(org.get('stripe_subscription_id') || '').trim()) {
        org.set('stripe_subscription_id', subscriptionId)
        changed = true
      }
      if (subscriptionId && String(org.get('subscription_status') || 'none') === 'none') {
        org.set('subscription_status', 'active')
        changed = true
      }

      if (changed) {
        app.save(org)
      }
    }
  }
}, (app) => {
  const organizations = app.findCollectionByNameOrId('organizations')

  for (const name of [
    'status',
    'stripe_customer_id',
    'stripe_subscription_id',
    'subscription_status',
    'closed_at',
    'purge_scheduled_at',
    'closed_by'
  ]) {
    const field = organizations.fields.getByName(name)
    if (field) {
      organizations.fields.removeById(field.id)
    }
  }

  app.save(organizations)
})
