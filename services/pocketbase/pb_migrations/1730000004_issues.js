/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')
  const users = app.findCollectionByNameOrId('users')

  const collection = new Collection({
    name: 'accessibility_issues',
    type: 'base',
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
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
        name: 'page',
        type: 'relation',
        required: true,
        collectionId: pages.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      { name: 'rule_id', type: 'text', required: true },
      {
        name: 'wcag_level',
        type: 'select',
        values: ['A', 'AA', 'AAA'],
        maxSelect: 1
      },
      { name: 'wcag_sc', type: 'text' },
      {
        name: 'wcag_version',
        type: 'select',
        values: ['2.0', '2.1', '2.2'],
        maxSelect: 1
      },
      {
        name: 'impact',
        type: 'select',
        values: ['critical', 'serious', 'moderate', 'minor'],
        maxSelect: 1
      },
      {
        name: 'type',
        type: 'select',
        values: ['error', 'warning', 'review'],
        maxSelect: 1
      },
      {
        name: 'element_type',
        type: 'select',
        values: ['image', 'form', 'link', 'heading', 'table', 'media', 'aria', 'other'],
        maxSelect: 1
      },
      {
        name: 'responsible_role',
        type: 'select',
        values: ['developer', 'editor', 'designer'],
        maxSelect: 1
      },
      { name: 'help_url', type: 'url' },
      { name: 'description', type: 'text' },
      { name: 'html_snippet', type: 'text', max: 10000 },
      { name: 'css_selector', type: 'text' },
      { name: 'fix_suggestion', type: 'text', max: 10000 },
      {
        name: 'status',
        type: 'select',
        values: ['open', 'dismissed', 'fixed'],
        maxSelect: 1
      },
      {
        name: 'dismissed_by',
        type: 'relation',
        collectionId: users.id,
        maxSelect: 1
      },
      { name: 'dismissed_at', type: 'date' },
      { name: 'dismiss_reason', type: 'text' }
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('accessibility_issues')
  app.delete(collection)
})
