/**
 * Remove ALL organizations, app users, and tenant data (development blank slate).
 *
 * Usage:
 *   npm run reset-dev-tenants -- --confirm
 *
 * Does NOT delete PocketBase superuser accounts or collection schema.
 * After reset, docker seed may recreate APP_USER + default org on next PB boot
 * only if you wiped the volume — this script leaves bootstrap markers intact.
 */
import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import { resetDevTenants } from '../db/purgeClosedOrgs.js'

loadScannerEnv()

const confirmed = process.argv.includes('--confirm')

async function main() {
  if (!confirmed) {
    console.error('Refusing to run without --confirm.')
    console.error('This deletes ALL organizations, users, sites, scans, and related data.')
    console.error('Example: npm run reset-dev-tenants -- --confirm')
    process.exit(1)
  }

  await authenticateAdmin()
  const pb = getPocketBase()

  console.log('Resetting all tenant data (dev)…')
  console.log('(Uses PocketBase cascade deletes — large sites may take a minute per site.)')
  const result = await resetDevTenants(pb)
  console.log(`\nDone. Organizations removed: ${result.organizationsPurged}`)
  if (result.errors.length) {
    console.log(`Errors (${result.errors.length}):`)
    for (const line of result.errors.slice(0, 20)) {
      console.log(`  ${line}`)
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
