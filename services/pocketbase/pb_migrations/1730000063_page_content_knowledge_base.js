/// <reference path="../pb_data/types.d.ts" />

/** Read gate: any site_access role (including viewer). */
const SITE_ACCESS_READ =
  '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteReadRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS_READ}${siteField}))`
}

function addFieldIfMissing(collection, field) {
  if (!collection.fields.getByName(field.name)) {
    collection.fields.add(new Field(field))
  }
}

migrate((app) => {
  const organizations = app.findCollectionByNameOrId('organizations')
  const sites = app.findCollectionByNameOrId('sites')
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')

  let pageContentBlobs
  try {
    pageContentBlobs = app.findCollectionByNameOrId('page_content_blobs')
  } catch (_) {
    pageContentBlobs = new Collection({
      name: 'page_content_blobs',
      type: 'base',
      listRule: orgSiteReadRule('site'),
      viewRule: orgSiteReadRule('site'),
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
        { name: 'content_hash', type: 'text', required: true, max: 128 },
        {
          name: 'content_kind',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['markdown']
        },
        {
          name: 'body',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['text/markdown', 'text/plain']
        },
        { name: 'byte_size', type: 'number', min: 0 },
        { name: 'char_count', type: 'number', min: 0 },
        { name: 'first_seen_at', type: 'date' },
        { name: 'last_seen_at', type: 'date' }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_page_content_blobs_site_hash ON page_content_blobs (site, content_hash)',
        'CREATE INDEX idx_page_content_blobs_org ON page_content_blobs (organization)',
        'CREATE INDEX idx_page_content_blobs_hash ON page_content_blobs (content_hash)'
      ]
    })
    app.save(pageContentBlobs)
  }

  let pageContentObservations
  try {
    pageContentObservations = app.findCollectionByNameOrId('page_content_observations')
  } catch (_) {
    pageContentObservations = new Collection({
      name: 'page_content_observations',
      type: 'base',
      listRule: orgSiteReadRule('site'),
      viewRule: orgSiteReadRule('site'),
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
          required: false,
          collectionId: pages.id,
          maxSelect: 1,
          cascadeDelete: false
        },
        { name: 'url', type: 'url', required: true },
        {
          name: 'content_blob',
          type: 'relation',
          required: true,
          collectionId: pageContentBlobs.id,
          maxSelect: 1,
          cascadeDelete: false
        },
        { name: 'content_hash', type: 'text', required: true, max: 128 },
        { name: 'unchanged', type: 'bool' },
        { name: 'observed_at', type: 'date' },
        { name: 'title', type: 'text', max: 500 }
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_page_content_obs_scan_url ON page_content_observations (scan, url)',
        'CREATE INDEX idx_page_content_obs_site_url_observed ON page_content_observations (site, url, observed_at)',
        'CREATE INDEX idx_page_content_obs_blob ON page_content_observations (content_blob)',
        'CREATE INDEX idx_page_content_obs_scan_unchanged ON page_content_observations (scan, unchanged)'
      ]
    })
    app.save(pageContentObservations)

    // Self-relation must be added after the collection exists (collectionId cannot be blank on create).
    const obsCollection = app.findCollectionByNameOrId('page_content_observations')
    if (!obsCollection.fields.getByName('previous_observation')) {
      obsCollection.fields.add(new Field({
        name: 'previous_observation',
        type: 'relation',
        required: false,
        collectionId: obsCollection.id,
        maxSelect: 1,
        cascadeDelete: false
      }))
      app.save(obsCollection)
    }
  }

  addFieldIfMissing(pages, {
    name: 'content_blob',
    type: 'relation',
    required: false,
    collectionId: pageContentBlobs.id,
    maxSelect: 1,
    cascadeDelete: false
  })
  addFieldIfMissing(pages, { name: 'content_hash', type: 'text', max: 128 })
  addFieldIfMissing(pages, { name: 'content_unchanged', type: 'bool' })
  app.save(pages)
}, (app) => {
  try {
    const pages = app.findCollectionByNameOrId('pages')
    for (const name of ['content_blob', 'content_hash', 'content_unchanged']) {
      const field = pages.fields.getByName(name)
      if (field) pages.fields.removeById(field.id)
    }
    app.save(pages)
  } catch (_) {}

  for (const name of ['page_content_observations', 'page_content_blobs']) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (_) {}
  }
})
