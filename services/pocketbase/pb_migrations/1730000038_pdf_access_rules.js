/// <reference path="../pb_data/types.d.ts" />

/** Read gate: any site_access role (including viewer). */
const SITE_ACCESS_READ =
  '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

function siteAccessWrite(siteField) {
  return `@request.auth.role = "admin" || (@collection.site_access.site ?= ${siteField} && @collection.site_access.user ?= @request.auth.id && @collection.site_access.role ?!= "viewer")`
}

function orgSiteReadRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS_READ}${siteField}))`
}

function orgSiteWriteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${siteAccessWrite(siteField)})`
}

migrate((app) => {
  for (const name of ['pdf_documents', 'pdf_issues']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      const siteField = name === 'pdf_documents' ? 'site' : 'pdf_document.site'
      collection.listRule = orgSiteReadRule(siteField)
      collection.viewRule = orgSiteReadRule(siteField)
      if (name === 'pdf_documents') {
        collection.createRule = orgSiteWriteRule('site')
        collection.updateRule = orgSiteWriteRule('site')
        collection.deleteRule = orgSiteWriteRule('site')
      }
      app.save(collection)
    } catch (_) {}
  }
}, (app) => {
  // Rule rollback not attempted.
})
