/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const sites = app.findCollectionByNameOrId('sites')
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')

  const policies = new Collection({
    name: 'policies',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    fields: [
      {
        name: 'site',
        type: 'relation',
        collectionId: sites.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text' },
      {
        name: 'rule_type',
        type: 'select',
        values: ['keyword', 'regex', 'html_attribute'],
        maxSelect: 1
      },
      { name: 'pattern', type: 'text', required: true },
      {
        name: 'category',
        type: 'select',
        values: ['qa', 'accessibility', 'brand', 'security'],
        maxSelect: 1
      },
      {
        name: 'severity',
        type: 'select',
        values: ['error', 'warning'],
        maxSelect: 1
      },
      { name: 'enabled', type: 'bool' }
    ]
  })

  const policyMatches = new Collection({
    name: 'policy_matches',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '@request.auth.id != ""',
    deleteRule: '',
    fields: [
      {
        name: 'scan',
        type: 'relation',
        required: true,
        collectionId: scans.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'policy',
        type: 'relation',
        required: true,
        collectionId: policies.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'page',
        type: 'relation',
        required: true,
        collectionId: pages.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'matched_text', type: 'text' },
      { name: 'context', type: 'text' },
      {
        name: 'status',
        type: 'select',
        values: ['open', 'dismissed', 'fixed'],
        maxSelect: 1
      }
    ]
  })

  app.save(policies)
  app.save(policyMatches)
}, (app) => {
  for (const name of ['policy_matches', 'policies']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
