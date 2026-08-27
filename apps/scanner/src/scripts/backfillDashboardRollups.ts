import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import { recomputeDashboardRollupsForSite } from '../dashboard/rollupWriter.js'

loadScannerEnv()

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find(arg => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined
}

async function main() {
  await authenticateAdmin()
  const pb = getPocketBase()
  const orgId = parseArg('org')
  const siteId = parseArg('site')
  const filters: string[] = []
  if (orgId) filters.push(`organization = "${orgId}"`)
  if (siteId) filters.push(`id = "${siteId}"`)
  const sites = await pb.collection('sites').getFullList({
    filter: filters.length ? filters.join(' && ') : undefined,
    fields: 'id,name'
  }) as Array<{ id: string, name: string }>

  console.log(`Backfilling dashboard rollups for ${sites.length} site(s)...`)
  for (const site of sites) {
    await recomputeDashboardRollupsForSite(pb, site.id)
    console.log(`  updated ${site.name} (${site.id})`)
  }
  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
