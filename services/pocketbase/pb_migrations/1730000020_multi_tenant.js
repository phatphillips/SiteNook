/// <reference path="../pb_data/types.d.ts" />

/** Org + site_access gate used in collection API rules. */
const SITE_ACCESS = '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS}${siteField}))`
}

function sitesRule() {
  return `organization = @request.auth.organization && (${SITE_ACCESS}id))`
}

const RULES = {
  organizations: {
    listRule: '@request.auth.id != "" && id = @request.auth.organization',
    viewRule: '@request.auth.id != "" && id = @request.auth.organization',
    createRule: '',
    updateRule: '@request.auth.role = "admin" && id = @request.auth.organization',
    deleteRule: ''
  },
  sites: {
    listRule: sitesRule(),
    viewRule: sitesRule(),
    createRule: 'organization = @request.auth.organization',
    updateRule: sitesRule(),
    deleteRule: sitesRule()
  },
  scans: {
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: '',
    updateRule: orgSiteRule('site'),
    deleteRule: orgSiteRule('site')
  },
  pages: {
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: '',
    updateRule: '',
    deleteRule: ''
  },
  accessibility_issues: {
    listRule: orgSiteRule('scan.site'),
    viewRule: orgSiteRule('scan.site'),
    createRule: '',
    updateRule: orgSiteRule('scan.site'),
    deleteRule: orgSiteRule('scan.site')
  },
  qa_broken_links: {
    listRule: orgSiteRule('scan.site'),
    viewRule: orgSiteRule('scan.site'),
    createRule: '',
    updateRule: orgSiteRule('scan.site'),
    deleteRule: ''
  },
  qa_spelling: {
    listRule: orgSiteRule('scan.site'),
    viewRule: orgSiteRule('scan.site'),
    createRule: '',
    updateRule: orgSiteRule('scan.site'),
    deleteRule: ''
  },
  qa_inventory: {
    listRule: orgSiteRule('scan.site'),
    viewRule: orgSiteRule('scan.site'),
    createRule: '',
    updateRule: '',
    deleteRule: ''
  },
  policies: {
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: orgSiteRule('site'),
    updateRule: orgSiteRule('site'),
    deleteRule: orgSiteRule('site')
  },
  policy_matches: {
    listRule: orgSiteRule('scan.site'),
    viewRule: orgSiteRule('scan.site'),
    createRule: '',
    updateRule: orgSiteRule('scan.site'),
    deleteRule: ''
  },
  scan_queue: {
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: orgSiteRule('site'),
    updateRule: orgSiteRule('site'),
    deleteRule: orgSiteRule('site')
  },
  scan_log_events: {
    listRule: orgSiteRule('site'),
    viewRule: orgSiteRule('site'),
    createRule: '',
    updateRule: '',
    deleteRule: ''
  },
  site_access: {
    listRule: '@request.auth.id != "" && (user = @request.auth.id || (@request.auth.role = "admin" && site.organization = @request.auth.organization))',
    viewRule: '@request.auth.id != "" && (user = @request.auth.id || (@request.auth.role = "admin" && site.organization = @request.auth.organization))',
    createRule: '@request.auth.role = "admin" && site.organization = @request.auth.organization',
    updateRule: '@request.auth.role = "admin" && site.organization = @request.auth.organization',
    deleteRule: '@request.auth.role = "admin" && site.organization = @request.auth.organization'
  },
  users: {
    listRule: 'organization = @request.auth.organization',
    viewRule: 'organization = @request.auth.organization',
    updateRule: 'id = @request.auth.id || (@request.auth.role = "admin" && organization = @request.auth.organization)',
    deleteRule: ''
  }
}

function applyRules(collection, rules) {
  collection.listRule = rules.listRule
  collection.viewRule = rules.viewRule
  if ('createRule' in rules) collection.createRule = rules.createRule
  if ('updateRule' in rules) collection.updateRule = rules.updateRule
  if ('deleteRule' in rules) collection.deleteRule = rules.deleteRule
}

function ensureSiteAccess(app, siteAccessCollection, userId, siteId, role) {
  if (!userId || !siteId) return

  const existing = app.findRecordsByFilter(
    'site_access',
    'user = {:user} && site = {:site}',
    '',
    1,
    0,
    { user: userId, site: siteId }
  )
  if (existing.length > 0) return

  const record = new Record(siteAccessCollection)
  record.set('user', userId)
  record.set('site', siteId)
  record.set('role', role)
  app.save(record)
}

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const sites = app.findCollectionByNameOrId('sites')

  let organizations = null
  try {
    organizations = app.findCollectionByNameOrId('organizations')
  } catch (_) {
    organizations = new Collection({
      name: 'organizations',
      type: 'base',
      listRule: RULES.organizations.listRule,
      viewRule: RULES.organizations.viewRule,
      createRule: RULES.organizations.createRule,
      updateRule: RULES.organizations.updateRule,
      deleteRule: RULES.organizations.deleteRule,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'subdomain', type: 'text', required: true, min: 2, max: 63 },
        {
          name: 'plan',
          type: 'select',
          values: ['free', 'standard', 'enterprise'],
          maxSelect: 1
        }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_organizations_subdomain ON organizations (subdomain)'
      ]
    })
    app.save(organizations)
  }

  if (!users.fields.getByName('organization')) {
    users.fields.add(new Field({
      name: 'organization',
      type: 'relation',
      collectionId: organizations.id,
      maxSelect: 1
    }))
  }
  applyRules(users, RULES.users)
  app.save(users)

  if (!sites.fields.getByName('organization')) {
    sites.fields.add(new Field({
      name: 'organization',
      type: 'relation',
      collectionId: organizations.id,
      maxSelect: 1
    }))
    app.save(sites)
  }

  let siteAccess = null
  try {
    siteAccess = app.findCollectionByNameOrId('site_access')
  } catch (_) {
    siteAccess = new Collection({
      name: 'site_access',
      type: 'base',
      listRule: RULES.site_access.listRule,
      viewRule: RULES.site_access.viewRule,
      createRule: RULES.site_access.createRule,
      updateRule: RULES.site_access.updateRule,
      deleteRule: RULES.site_access.deleteRule,
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: users.id,
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
          name: 'role',
          type: 'select',
          required: true,
          values: ['owner', 'editor', 'viewer'],
          maxSelect: 1
        }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_site_access_user_site ON site_access (user, site)'
      ]
    })
    app.save(siteAccess)
  }

  // site rules reference @collection.site_access — apply after site_access exists
  applyRules(sites, RULES.sites)
  app.save(sites)

  for (const name of [
    'scans',
    'pages',
    'accessibility_issues',
    'qa_broken_links',
    'qa_spelling',
    'qa_inventory',
    'policies',
    'policy_matches',
    'scan_queue',
    'scan_log_events'
  ]) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      if (RULES[name]) {
        applyRules(collection, RULES[name])
        app.save(collection)
      }
    } catch (_) {}
  }

  let defaultOrg = null
  const orgRecords = app.findRecordsByFilter(
    'organizations',
    'subdomain = {:subdomain}',
    '',
    1,
    0,
    { subdomain: 'default' }
  )
  if (orgRecords.length > 0) {
    defaultOrg = orgRecords[0]
  } else {
    defaultOrg = new Record(organizations)
    defaultOrg.set('name', 'Default Organization')
    defaultOrg.set('subdomain', 'default')
    defaultOrg.set('plan', 'standard')
    app.save(defaultOrg)
  }

  for (const user of app.findAllRecords('users')) {
    if (!user.get('organization')) {
      user.set('organization', defaultOrg.id)
      app.save(user)
    }
  }

  for (const site of app.findAllRecords('sites')) {
    if (!site.get('organization')) {
      site.set('organization', defaultOrg.id)
      app.save(site)
    }
    const ownerId = site.get('owner')
    ensureSiteAccess(app, siteAccess, ownerId, site.id, 'owner')
    for (const user of app.findAllRecords('users')) {
      if (user.get('role') === 'admin') {
        ensureSiteAccess(app, siteAccess, user.id, site.id, 'owner')
      }
    }
  }
}, (app) => {
  for (const name of ['site_access', 'organizations']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }

  for (const collectionName of ['users', 'sites']) {
    try {
      const collection = app.findCollectionByNameOrId(collectionName)
      if (collection.fields.getByName('organization')) {
        collection.fields.removeByName('organization')
        app.save(collection)
      }
    } catch (_) {}
  }
})
