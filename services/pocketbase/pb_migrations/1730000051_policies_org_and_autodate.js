/// <reference path="../pb_data/types.d.ts" />

/**
 * Policies: add created/updated (client sort=-created was 400), organization for
 * org-wide (empty site) rules, and API rules that work for both scopes.
 */
migrate((app) => {
  const policies = app.findCollectionByNameOrId('policies')
  const organizations = app.findCollectionByNameOrId('organizations')

  if (!policies.fields.getByName('organization')) {
    policies.fields.add(new Field({
      name: 'organization',
      type: 'relation',
      required: false,
      collectionId: organizations.id,
      maxSelect: 1,
      cascadeDelete: true
    }))
  }
  if (!policies.fields.getByName('created')) {
    policies.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!policies.fields.getByName('updated')) {
    policies.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }

  const ORG_WRITE = '(@request.auth.role = "admin")'
  policies.listRule = 'organization = @request.auth.organization'
  policies.viewRule = 'organization = @request.auth.organization'
  policies.createRule =
    'organization = @request.auth.organization && ' + ORG_WRITE
    + ' && (site = "" || site.organization = @request.auth.organization)'
  policies.updateRule =
    'organization = @request.auth.organization && ' + ORG_WRITE
    + ' && (site = "" || site.organization = @request.auth.organization)'
  policies.deleteRule =
    'organization = @request.auth.organization && ' + ORG_WRITE

  app.save(policies)

  const rows = app.findAllRecords('policies')
  for (const row of rows) {
    const orgId = String(row.get('organization') || '').trim()
    if (orgId) continue
    const siteId = String(row.get('site') || '').trim()
    if (!siteId) continue
    try {
      const site = app.findRecordById('sites', siteId)
      const fromSite = String(site.get('organization') || '').trim()
      if (!fromSite) continue
      row.set('organization', fromSite)
      app.save(row)
    } catch (_) {}
  }
}, (app) => {
  try {
    const policies = app.findCollectionByNameOrId('policies')
    policies.listRule = 'site.organization = @request.auth.organization'
    policies.viewRule = 'site.organization = @request.auth.organization'
    policies.createRule = 'site.organization = @request.auth.organization && (@request.auth.role = "admin")'
    policies.updateRule = 'site.organization = @request.auth.organization && (@request.auth.role = "admin")'
    policies.deleteRule = 'site.organization = @request.auth.organization && (@request.auth.role = "admin")'
    policies.fields.removeByName('organization')
    policies.fields.removeByName('created')
    policies.fields.removeByName('updated')
    app.save(policies)
  } catch (_) {}
})
