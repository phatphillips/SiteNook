/// <reference path="../pb_data/types.d.ts" />

const SITE_ACCESS = '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function orgSiteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS}${siteField}))`
}

const INVENTORY_REFS_RULES = {
  listRule: orgSiteRule('scan.site'),
  viewRule: orgSiteRule('scan.site'),
  createRule: '',
  updateRule: '',
  deleteRule: ''
}

migrate((app) => {
  const scans = app.findCollectionByNameOrId('scans')
  const pages = app.findCollectionByNameOrId('pages')
  const inventory = app.findCollectionByNameOrId('qa_inventory')

  try {
    app.findCollectionByNameOrId('qa_inventory_refs')
  } catch (_) {
    const refs = new Collection({
      name: 'qa_inventory_refs',
      type: 'base',
      listRule: INVENTORY_REFS_RULES.listRule,
      viewRule: INVENTORY_REFS_RULES.viewRule,
      createRule: INVENTORY_REFS_RULES.createRule,
      updateRule: INVENTORY_REFS_RULES.updateRule,
      deleteRule: INVENTORY_REFS_RULES.deleteRule,
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
        { name: 'asset_url', type: 'url', required: true }
      ],
      indexes: [
        'CREATE INDEX idx_qa_inventory_refs_scan_asset ON qa_inventory_refs (scan, asset_url)',
        'CREATE UNIQUE INDEX idx_qa_inventory_refs_scan_asset_page ON qa_inventory_refs (scan, asset_url, page)'
      ]
    })
    app.save(refs)
  }

  if (!inventory.fields.getByName('found_on_page_count')) {
    inventory.fields.add(new NumberField({
      name: 'found_on_page_count',
      min: 0
    }))
    app.save(inventory)
  }
}, (app) => {
  try {
    app.delete(app.findCollectionByNameOrId('qa_inventory_refs'))
  } catch (_) {}

  try {
    const inventory = app.findCollectionByNameOrId('qa_inventory')
    inventory.fields.removeByName('found_on_page_count')
    app.save(inventory)
  } catch (_) {}
})
