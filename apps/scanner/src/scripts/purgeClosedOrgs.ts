/**
 * Permanently delete closed organizations and all dependent data.
 *
 * Usage:
 *   npm run purge-closed-orgs
 *   npm run purge-closed-orgs -- --force
 *   npm run purge-closed-orgs -- --org-id=u41algm81p7ia02
 *   npm run purge-closed-orgs -- --org-id=u41algm81p7ia02 --force
 *
 * Loads POCKETBASE_ADMIN_* from apps/scanner/.env or repo root .env (PB_ADMIN_* mapped).
 */
import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import { purgeClosedOrganizations } from '../db/purgeClosedOrgs.js'

loadScannerEnv()

function readArg(prefix: string): string | undefined {
  const match = process.argv.find(arg => arg.startsWith(`${prefix}=`))
  return match?.slice(prefix.length + 1).trim() || undefined
}

const force = process.argv.includes('--force')
const organizationId = readArg('--org-id')

async function main() {
  await authenticateAdmin()
  const pb = getPocketBase()

  if (force) {
    console.log('Force mode — skipping 30-day retention check.')
  }
  if (organizationId) {
    console.log(`Targeting organization: ${organizationId}`)
  }
  console.log('Purging closed organizations…')

  const result = await purgeClosedOrganizations(pb, { force, organizationId })
  console.log(`\nDone. Organizations purged: ${result.organizationsPurged}`)
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
