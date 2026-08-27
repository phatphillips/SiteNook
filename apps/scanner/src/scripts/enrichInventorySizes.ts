import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import { enrichScanInventorySizes } from '../qa/resolveInventorySizes.js'

const arg1 = process.argv[2]
const arg2 = process.argv[3]

if (!arg1) {
  console.error('Usage: npx tsx src/scripts/enrichInventorySizes.ts <scanId>')
  console.error('       npx tsx src/scripts/enrichInventorySizes.ts --site <siteId>')
  process.exit(1)
}

await authenticateAdmin()
const pb = getPocketBase()

let targetScanId = arg1
if (arg1 === '--site') {
  if (!arg2) {
    console.error('Missing site id after --site')
    process.exit(1)
  }
  const scans = await pb.collection('scans').getList(1, 1, {
    filter: `site = "${arg2}" && status = 'complete'`,
    sort: '-completed_at',
    fields: 'id'
  })
  targetScanId = String(scans.items[0]?.id ?? '')
  if (!targetScanId) {
    console.error('No complete scan found for site', arg2)
    process.exit(1)
  }
}

console.log('Enriching inventory sizes for scan', targetScanId)
await enrichScanInventorySizes(pb, targetScanId)
console.log('Done')
