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
  try {
    const collection = app.findCollectionByNameOrId('seo_issues')
    collection.listRule = orgSiteReadRule('scan.site')
    collection.viewRule = orgSiteReadRule('scan.site')
    collection.updateRule = orgSiteWriteRule('scan.site')
    collection.deleteRule = orgSiteWriteRule('scan.site')
    app.save(collection)
  } catch (_) {}
}, (app) => {
  // Rule rollback not attempted.
})
