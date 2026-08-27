/// <reference path="../pb_data/types.d.ts" />

/**
 * Audit log for accessibility issue dismiss / fix / reopen actions.
 */
migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')

  let exists = false
  try {
    app.findCollectionByNameOrId('accessibility_issue_actions')
    exists = true
  } catch (_) {}

  if (exists) return

  const collection = new Collection({
    name: 'accessibility_issue_actions',
    type: 'base',
    listRule: 'organization = @request.auth.organization',
    viewRule: 'organization = @request.auth.organization',
    createRule: '@request.auth.id != "" && organization = @request.auth.organization',
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
        name: 'actor',
        type: 'relation',
        required: false,
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false
      },
      {
        name: 'action',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['dismissed', 'fixed', 'reopened']
      },
      {
        name: 'scope',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['rule', 'page']
      },
      { name: 'rule_id', type: 'text', required: true },
      { name: 'description', type: 'text' },
      {
        name: 'impact',
        type: 'select',
        values: ['critical', 'serious', 'moderate', 'minor'],
        maxSelect: 1
      },
      {
        name: 'wcag_level',
        type: 'select',
        values: ['A', 'AA', 'AAA'],
        maxSelect: 1
      },
      { name: 'page_url', type: 'text' },
      { name: 'page_title', type: 'text' },
      { name: 'dismiss_reason', type: 'text' },
      { name: 'issue_ids', type: 'json' },
      { name: 'logged_at', type: 'date', required: true }
    ],
    indexes: [
      'CREATE INDEX idx_a11y_issue_actions_site_logged ON accessibility_issue_actions (site, logged_at)',
      'CREATE INDEX idx_a11y_issue_actions_org_logged ON accessibility_issue_actions (organization, logged_at)'
    ]
  })

  app.save(collection)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('accessibility_issue_actions')
    app.delete(collection)
  } catch (_) {}
})
