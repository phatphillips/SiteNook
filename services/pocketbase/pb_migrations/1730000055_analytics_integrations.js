/// <reference path="../pb_data/types.d.ts" />

/**
 * Analytics integrations: encrypted provider connections + synced snapshots.
 * Extends team_activity_log actions for connect/disconnect/reconnect events.
 */
migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')

  let connectionsExist = false
  try {
    app.findCollectionByNameOrId('analytics_connections')
    connectionsExist = true
  } catch (_) {}

  if (!connectionsExist) {
    const connections = new Collection({
      name: 'analytics_connections',
      type: 'base',
      listRule: 'organization = @request.auth.organization',
      viewRule: 'organization = @request.auth.organization',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'organization',
          type: 'relation',
          required: true,
          collectionId: organizations.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'site',
          type: 'relation',
          required: true,
          collectionId: sites.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'provider',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ga4', 'cloudflare', 'plausible', 'umami', 'fathom', 'matomo']
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['connected', 'error', 'needs_reconnect', 'disconnected']
        },
        {
          name: 'credentials_encrypted',
          type: 'text',
          required: false,
          max: 20000
        },
        {
          name: 'credentials_meta',
          type: 'json'
        },
        {
          name: 'external_ids',
          type: 'json'
        },
        {
          name: 'last_synced_at',
          type: 'date',
          required: false
        },
        {
          name: 'last_sync_status',
          type: 'select',
          required: false,
          maxSelect: 1,
          values: ['ok', 'auth_error', 'rate_limited', 'provider_error']
        },
        {
          name: 'last_error',
          type: 'text',
          required: false,
          max: 500
        },
        {
          name: 'next_sync_at',
          type: 'date',
          required: false
        },
        {
          name: 'sync_interval_hours',
          type: 'number',
          required: false,
          min: 1,
          max: 168
        }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_analytics_conn_site_provider ON analytics_connections (site, provider)',
        'CREATE INDEX idx_analytics_conn_org ON analytics_connections (organization)',
        'CREATE INDEX idx_analytics_conn_next_sync ON analytics_connections (status, next_sync_at)'
      ]
    })
    app.save(connections)
  }

  let snapshotsExist = false
  try {
    app.findCollectionByNameOrId('analytics_snapshots')
    snapshotsExist = true
  } catch (_) {}

  if (!snapshotsExist) {
    const connections = app.findCollectionByNameOrId('analytics_connections')
    const snapshots = new Collection({
      name: 'analytics_snapshots',
      type: 'base',
      listRule: 'organization = @request.auth.organization',
      viewRule: 'organization = @request.auth.organization',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'organization',
          type: 'relation',
          required: true,
          collectionId: organizations.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'site',
          type: 'relation',
          required: true,
          collectionId: sites.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'connection',
          type: 'relation',
          required: true,
          collectionId: connections.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        {
          name: 'range_start',
          type: 'date',
          required: true
        },
        {
          name: 'range_end',
          type: 'date',
          required: true
        },
        {
          name: 'granularity',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['daily', 'range']
        },
        {
          name: 'metrics',
          type: 'json'
        }
      ],
      indexes: [
        'CREATE INDEX idx_analytics_snap_conn ON analytics_snapshots (connection)',
        'CREATE INDEX idx_analytics_snap_org ON analytics_snapshots (organization)',
        'CREATE UNIQUE INDEX idx_analytics_snap_unique ON analytics_snapshots (connection, range_start, range_end, granularity)'
      ]
    })
    app.save(snapshots)
  }

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
        'subscription_updated',
        'analytics_connected',
        'analytics_disconnected',
        'analytics_reconnected',
        'analytics_sync_needs_reconnect'
      ]
      app.save(activityLog)
    }
  } catch (_) {}
}, (app) => {
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

  try {
    app.delete(app.findCollectionByNameOrId('analytics_snapshots'))
  } catch (_) {}

  try {
    app.delete(app.findCollectionByNameOrId('analytics_connections'))
  } catch (_) {}
})
