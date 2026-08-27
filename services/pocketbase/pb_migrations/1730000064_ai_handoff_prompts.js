/// <reference path="../pb_data/types.d.ts" />

function orgRule() {
  return 'org = @request.auth.organization'
}

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const users = app.findCollectionByNameOrId('users')

  addFieldIfMissing(sites, { name: 'handoff_prompts', type: 'json' })
  app.save(sites)

  let packs
  try {
    packs = app.findCollectionByNameOrId('ai_handoff_packs')
  } catch (_) {
    packs = new Collection({
      name: 'ai_handoff_packs',
      type: 'base',
      listRule: orgRule(),
      viewRule: orgRule(),
      createRule: orgRule(),
      updateRule: '',
      deleteRule: orgRule(),
      fields: [
        {
          name: 'org',
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
          name: 'section',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['content', 'accessibility', 'seo', 'qa']
        },
        { name: 'prompt_snapshot', type: 'text', max: 20000 },
        { name: 'page_urls', type: 'json' },
        { name: 'page_count', type: 'number', min: 0 },
        {
          name: 'artifact',
          type: 'file',
          maxSelect: 1,
          maxSize: 1024 * 1024 * 40,
          mimeTypes: ['application/zip']
        },
        {
          name: 'created_by',
          type: 'relation',
          required: false,
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false
        }
      ],
      indexes: [
        'CREATE INDEX idx_ai_handoff_packs_org ON ai_handoff_packs (org)',
        'CREATE INDEX idx_ai_handoff_packs_site ON ai_handoff_packs (site)'
      ]
    })
    app.save(packs)
  }

  if (!packs.fields.getByName('created')) {
    packs.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!packs.fields.getByName('updated')) {
    packs.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(packs)
}, (app) => {
  try {
    const sites = app.findCollectionByNameOrId('sites')
    if (sites.fields.getByName('handoff_prompts')) {
      sites.fields.removeByName('handoff_prompts')
      app.save(sites)
    }
  } catch (_) {}

  try {
    app.delete(app.findCollectionByNameOrId('ai_handoff_packs'))
  } catch (_) {}
})
