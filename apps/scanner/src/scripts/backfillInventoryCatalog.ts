/**
 * Consolidate duplicate qa_inventory rows and enrich missing sizes for latest scans.
 *
 * Usage:
 *   tsx src/scripts/backfillInventoryCatalog.ts [siteId]
 */
import PocketBase from 'pocketbase'
import { consolidateScanInventory } from '../qa/consolidateScanInventory.js'
import {
  consolidateScanInventoryRefs,
  patchInventoryFoundOnPageCounts
} from '../qa/consolidateScanInventoryRefs.js'
import { enrichScanInventorySizes } from '../qa/resolveInventorySizes.js'

const pbUrl = process.env.POCKETBASE_URL || process.env.NUXT_POCKETBASE_URL || 'http://127.0.0.1:8090'
const email = process.env.POCKETBASE_ADMIN_EMAIL || process.env.NUXT_PB_ADMIN_EMAIL
const password = process.env.POCKETBASE_ADMIN_PASSWORD || process.env.NUXT_PB_ADMIN_PASSWORD
const siteFilter = process.argv[2]

if (!email || !password) {
  console.error('Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD')
  process.exit(1)
}

const pb = new PocketBase(pbUrl)
await pb.collection('_superusers').authWithPassword(email, password)

const siteFilterClause = siteFilter ? `id = "${siteFilter}"` : ''
const sites = await pb.collection('sites').getFullList({
  filter: siteFilterClause,
  fields: 'id,name',
  sort: 'name'
})

for (const site of sites) {
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${site.id}" && status = "complete"`,
    sort: '-completed_at',
    fields: 'id',
    limit: 1
  })
  const scanId = scans[0]?.id
  if (!scanId) {
    console.log(`${site.name}: no complete scan`)
    continue
  }

  const consolidated = await consolidateScanInventory(pb, scanId)
  console.log(`${site.name}: consolidated ${consolidated.before} -> ${consolidated.after}`)
  const refs = await consolidateScanInventoryRefs(pb, scanId)
  console.log(`${site.name}: refs ${refs.before} -> ${refs.after}`)
  await patchInventoryFoundOnPageCounts(pb, scanId)
  console.log(`${site.name}: page counts updated`)
  await enrichScanInventorySizes(pb, scanId)
  console.log(`${site.name}: size enrichment complete`)
}

console.log('Done.')
