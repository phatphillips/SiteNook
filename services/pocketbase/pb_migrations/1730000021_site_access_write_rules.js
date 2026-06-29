/// <reference path="../pb_data/types.d.ts" />

/** Read gate: any site_access role (including viewer). */
const SITE_ACCESS_READ =
  '@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.site ?= '

/** Write gate: owner/editor site_access, or org admin. */
function siteAccessWrite(siteField) {
  return `@request.auth.role = "admin" || (@collection.site_access.site ?= ${siteField} && @collection.site_access.user ?= @request.auth.id && @collection.site_access.role ?!= "viewer")`
}

function orgSiteReadRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${SITE_ACCESS_READ}${siteField}))`
}

function orgSiteWriteRule(siteField) {
  return `${siteField}.organization = @request.auth.organization && (${siteAccessWrite(siteField)})`
}

function sitesReadRule() {
  return `organization = @request.auth.organization && (${SITE_ACCESS_READ}id))`
}

function sitesWriteRule() {
  return `@request.auth.id != "" && organization = @request.auth.organization && (${siteAccessWrite('id')})`
}

function sitesCreateRule() {
  return `@request.auth.id != "" && organization = @request.auth.organization && (@request.auth.role = "admin" || (@collection.site_access.user ?= @request.auth.id && @collection.site_access.role ?!= "viewer"))`
}

const RULES = {
  sites: {
    listRule: sitesReadRule(),
    viewRule: sitesReadRule(),
    createRule: sitesCreateRule(),
    updateRule: sitesWriteRule(),
    deleteRule: sitesWriteRule()
  },
  scans: {
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site'),
    updateRule: orgSiteWriteRule('site'),
    deleteRule: orgSiteWriteRule('site')
  },
  pages: {
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site')
  },
  accessibility_issues: {
    listRule: orgSiteReadRule('scan.site'),
    viewRule: orgSiteReadRule('scan.site'),
    updateRule: orgSiteWriteRule('scan.site'),
    deleteRule: orgSiteWriteRule('scan.site')
  },
  qa_broken_links: {
    listRule: orgSiteReadRule('scan.site'),
    viewRule: orgSiteReadRule('scan.site'),
    updateRule: orgSiteWriteRule('scan.site')
  },
  qa_spelling: {
    listRule: orgSiteReadRule('scan.site'),
    viewRule: orgSiteReadRule('scan.site'),
    updateRule: orgSiteWriteRule('scan.site')
  },
  qa_inventory: {
    listRule: orgSiteReadRule('scan.site'),
    viewRule: orgSiteReadRule('scan.site')
  },
  policies: {
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site'),
    createRule: orgSiteWriteRule('site'),
    updateRule: orgSiteWriteRule('site'),
    deleteRule: orgSiteWriteRule('site')
  },
  policy_matches: {
    listRule: orgSiteReadRule('scan.site'),
    viewRule: orgSiteReadRule('scan.site'),
    updateRule: orgSiteWriteRule('scan.site')
  },
  scan_queue: {
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site'),
    createRule: orgSiteWriteRule('site'),
    updateRule: orgSiteWriteRule('site'),
    deleteRule: orgSiteWriteRule('site')
  },
  scan_log_events: {
    listRule: orgSiteReadRule('site'),
    viewRule: orgSiteReadRule('site')
  }
}

function applyRules(collection, rules) {
  collection.listRule = rules.listRule
  collection.viewRule = rules.viewRule
  if ('createRule' in rules) collection.createRule = rules.createRule
  if ('updateRule' in rules) collection.updateRule = rules.updateRule
  if ('deleteRule' in rules) collection.deleteRule = rules.deleteRule
}

migrate((app) => {
  for (const name of Object.keys(RULES)) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      applyRules(collection, RULES[name])
      app.save(collection)
    } catch (_) {}
  }
}, (app) => {
  // Rule rollback not attempted — prior migration 1730000020 rules remain in down().
})
