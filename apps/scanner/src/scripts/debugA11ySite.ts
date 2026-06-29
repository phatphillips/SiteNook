import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'

loadScannerEnv()
await authenticateAdmin()

const siteId = process.argv[2] || 'h2np44z48g96c0r'
const pb = getPocketBase()

const site = await pb.collection('sites').getOne(siteId, {
  fields: 'name,current_a11y,site_settings,default_scan_config'
})
const pages = await pb.collection('pages').getFullList({
  filter: `site = "${siteId}"`,
  expand: 'scan',
  fields: 'id,url,title,scan,site,created'
})
const openViaScanSite = await pb.collection('accessibility_issues').getFullList({
  filter: `scan.site = "${siteId}" && status = 'open'`,
  fields: 'id,page,rule_id,wcag_level,status'
})

console.log(JSON.stringify({
  name: site.name,
  pages: pages.length,
  openIssuesScanSite: openViaScanSite.length,
  summaryOpen: site.current_a11y?.open_issue_count,
  byRule: site.current_a11y?.by_rule?.length,
  siteSettings: site.site_settings ?? null
}, null, 2))
