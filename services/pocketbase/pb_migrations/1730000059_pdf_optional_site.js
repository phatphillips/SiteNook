/// <reference path="../pb_data/types.d.ts" />

/**
 * Allow org-level PDF uploads without a site assignment.
 * - site becomes optional
 * - organization added for ACL when site is empty
 * - backfill organization from site for existing rows
 */
migrate((app) => {
  const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
  const organizations = app.findCollectionByNameOrId('organizations')

  const siteField = pdfDocuments.fields.getByName('site')
  if (siteField) {
    siteField.required = false
    pdfDocuments.fields.add(siteField)
  }

  if (!pdfDocuments.fields.getByName('organization')) {
    pdfDocuments.fields.add(new Field({
      name: 'organization',
      type: 'relation',
      required: false,
      collectionId: organizations.id,
      maxSelect: 1,
      cascadeDelete: false
    }))
  }

  const siteAccessRead
    = '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= site)'
  const siteAccessWrite
    = '@request.auth.role = "admin" || (@collection.site_access.site ?= site && @collection.site_access.user ?= @request.auth.id && @collection.site_access.role ?!= "viewer")'
  const orgMatch = 'organization = @request.auth.organization'
  const siteOrgMatch = 'site.organization = @request.auth.organization'

  // Empty site → org library docs; otherwise site-scoped ACL (same as before).
  pdfDocuments.listRule
    = `@request.auth.id != "" && ((site = "" && ${orgMatch}) || (${siteOrgMatch} && (${siteAccessRead})))`
  pdfDocuments.viewRule = pdfDocuments.listRule
  pdfDocuments.createRule
    = `@request.auth.id != "" && ((site = "" && ${orgMatch}) || (${siteOrgMatch} && (${siteAccessWrite})))`
  pdfDocuments.updateRule = pdfDocuments.createRule
  pdfDocuments.deleteRule = pdfDocuments.createRule

  app.save(pdfDocuments)

  const rows = app.findAllRecords('pdf_documents')
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
    const pdfDocuments = app.findCollectionByNameOrId('pdf_documents')
    const siteField = pdfDocuments.fields.getByName('site')
    if (siteField) {
      siteField.required = true
      pdfDocuments.fields.add(siteField)
    }
    pdfDocuments.fields.removeByName('organization')
    app.save(pdfDocuments)
  } catch (_) {}
})
