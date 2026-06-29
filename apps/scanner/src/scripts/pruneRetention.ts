/**
 * One-time retention backfill: keep full crawl data only on each site's latest
 * completed scan; older runs become log-only rows.
 *
 * Usage:
 *   POCKETBASE_URL=... POCKETBASE_ADMIN_EMAIL=... POCKETBASE_ADMIN_PASSWORD=... \
 *     npm run prune-retention
 *
 *   npm run prune-retention -- --dry-run
 */
import { authenticateAdmin } from '../db/pocketbaseClient.js'
import { backfillRetentionForAllSites } from '../db/scanRetention.js'
import { loadScannerEnv } from '../config/loadEnv.js'

loadScannerEnv()

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await authenticateAdmin()
  console.log(dryRun ? 'Dry run — no records will be changed.' : 'Pruning superseded scan detail…')

  const result = await backfillRetentionForAllSites({
    dryRun,
    onSite(siteId, keepScanId, pruneCount) {
      if (pruneCount > 0) {
        console.log(
          `  site ${siteId}: keep=${keepScanId ?? 'none'}, prune ${pruneCount} scan(s)`
        )
      }
    }
  })

  console.log('\nDone.')
  console.log(`  Sites processed: ${result.sitesProcessed}`)
  console.log(`  Sites with a completed scan (detail kept): ${result.sitesWithCompleteScan}`)
  console.log(`  Scan detail pruned: ${result.scansPruned}`)
  if (result.skipped.length) {
    console.log(`  Skipped (${result.skipped.length}):`)
    for (const line of result.skipped.slice(0, 20)) console.log(`    ${line}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
