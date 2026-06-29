import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import {
  reconcileSiteCurrentA11y,
  rebuildScanA11ySummaryFromPb
} from '../accessibility/reconcileSiteCurrentA11y.js'

loadScannerEnv()

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find(arg => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined
}

async function loadSites(orgId?: string, siteId?: string) {
  const pb = getPocketBase()
  const filters: string[] = []
  if (siteId) filters.push(`id = "${siteId}"`)
  if (orgId) filters.push(`organization = "${orgId}"`)
  const filter = filters.length ? filters.join(' && ') : undefined
  return pb.collection('sites').getFullList({
    filter,
    fields: 'id,name,organization'
  }) as Promise<Array<{ id: string, name: string, organization: string }>>
}

async function reindexSite(siteId: string, siteName: string): Promise<{ scans: number }> {
  const pb = getPocketBase()
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${siteId}" && (status = 'complete' || status = 'complete_with_errors')`,
    fields: 'id,site,pages_crawled,score_denominators'
  }) as Array<{
    id: string
    site: string
    pages_crawled?: number
    score_denominators?: { elements?: Record<string, number> }
  }>

  for (const scan of scans) {
    await rebuildScanA11ySummaryFromPb(pb, scan)
  }

  await reconcileSiteCurrentA11y(pb, siteId)
  console.log(`  ${siteName}: ${scans.length} scan(s) reindexed`)
  return { scans: scans.length }
}

async function main() {
  await authenticateAdmin()
  const orgId = parseArg('org')
  const siteId = parseArg('site')
  const sites = await loadSites(orgId, siteId)

  if (!sites.length) {
    console.log('No sites matched.')
    return
  }

  console.log(`Reindexing a11y summaries for ${sites.length} site(s)...`)
  let totalScans = 0
  for (const site of sites) {
    const result = await reindexSite(site.id, site.name)
    totalScans += result.scans
  }
  console.log(`Done. ${totalScans} scan summary(ies) updated.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
