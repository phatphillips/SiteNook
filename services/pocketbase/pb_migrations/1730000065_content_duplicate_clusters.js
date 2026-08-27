/// <reference path="../pb_data/types.d.ts" />

/** Read gate: any site_access role (including viewer). */
const SITE_ACCESS_READ =
  '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteReadRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS_READ}${siteField}))`
}

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const scans = app.findCollectionByNameOrId('scans')

  try {
    app.findCollectionByNameOrId('content_duplicate_clusters')
    return
  } catch (_) {
    // create below
  }

  const collection = new Collection({
    name: 'content_duplicate_clusters',
    type: 'base',
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site'),
    createRule: '',
    updateRule: orgSiteReadRule('site'),
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
        name: 'scan',
        type: 'relation',
        required: true,
        collectionId: scans.id,
        maxSelect: 1,
        cascadeDelete: true
      },
      {
        name: 'kind',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['exact', 'near']
      },
      {
        name: 'similarity',
        type: 'number',
        required: true,
        min: 0,
        max: 1
      },
      {
        name: 'page_count',
        type: 'number',
        required: true,
        min: 2
      },
      { name: 'representative_url', type: 'text', required: true, max: 2000 },
      { name: 'representative_title', type: 'text', max: 500 },
      {
        name: 'members',
        type: 'json',
        required: true,
        maxSize: 200000
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['open', 'dismissed']
      }
    ],
    indexes: [
      'CREATE INDEX idx_content_dup_clusters_scan ON content_duplicate_clusters (scan)',
      'CREATE INDEX idx_content_dup_clusters_site ON content_duplicate_clusters (site)',
      'CREATE INDEX idx_content_dup_clusters_org ON content_duplicate_clusters (organization)',
      'CREATE INDEX idx_content_dup_clusters_kind ON content_duplicate_clusters (kind)'
    ]
  })

  app.save(collection)

  if (!collection.fields.getByName('created')) {
    collection.fields.add(new AutodateField({
      name: 'created',
      onCreate: true,
      onUpdate: false
    }))
  }
  if (!collection.fields.getByName('updated')) {
    collection.fields.add(new AutodateField({
      name: 'updated',
      onCreate: true,
      onUpdate: true
    }))
  }
  app.save(collection)
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('content_duplicate_clusters'))
  } catch (_) {}
})
