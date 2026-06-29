import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import { deleteSearchDocsForSite } from '../search/searchIndexer.js'

const DELETE_BATCH = 50

export interface PurgeClosedOrgsResult {
  organizationsPurged: number
  errors: string[]
}

export interface PurgeClosedOrgsOptions {
  /** Skip the 30-day grace period — dev only unless PURGE_ALLOW_FORCE=true in production */
  force?: boolean
  /** Purge a single organization by PocketBase id */
  organizationId?: string
  now?: Date
}

export function buildClosingOrganizationsFilter(options: PurgeClosedOrgsOptions): string {
  const parts = ['purge_scheduled_at != ""']

  if (options.organizationId?.trim()) {
    parts.push(`id = "${options.organizationId.trim().replace(/"/g, '\\"')}"`)
  }

  if (!options.force) {
    const isoNow = (options.now ?? new Date()).toISOString()
    parts.push(`purge_scheduled_at <= "${isoNow}"`)
  }

  return parts.join(' && ')
}

export function assertPurgeForceAllowed(force: boolean): void {
  if (!force) return
  if (process.env.NODE_ENV === 'production' && process.env.PURGE_ALLOW_FORCE !== 'true') {
    throw new Error(
      '--force is disabled in production. Set PURGE_ALLOW_FORCE=true to override, or wait for purge_scheduled_at.'
    )
  }
}

async function deleteByFilter(
  pb: PocketBase,
  collection: string,
  filter: string,
  onBatch?: (deleted: number) => void
): Promise<number> {
  let deleted = 0
  for (;;) {
    const batch = await pb.collection(collection).getList(1, DELETE_BATCH, {
      filter,
      fields: 'id'
    })
    if (!batch.items.length) break
    await Promise.all(batch.items.map(item => pb.collection(collection).delete(item.id)))
    deleted += batch.items.length
    onBatch?.(deleted)
    if (batch.items.length < DELETE_BATCH) break
  }
  return deleted
}

export async function purgeOrganizationData(
  pb: PocketBase,
  organizationId: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const log = onProgress ?? (() => {})

  const sites = await pb.collection('sites').getFullList({
    filter: `organization = "${organizationId}"`,
    fields: 'id,url'
  })

  if (sites.length) {
    log(`  Removing ${sites.length} site(s) and dependent scan data…`)
  }

  for (const site of sites) {
    const label = String(site.url || site.id)
    log(`  Deleting site ${label}…`)
    await deleteSearchDocsForSite(site.id).catch(err => {
      log(`  Warning: search index cleanup failed for site ${site.id}: ${err instanceof Error ? err.message : err}`)
    })
    await pb.collection('sites').delete(site.id)
  }

  const activityRemoved = await deleteByFilter(
    pb,
    'team_activity_log',
    `organization = "${organizationId}"`
  )
  if (activityRemoved > 0) {
    log(`  Removed ${activityRemoved} team_activity_log row(s)`)
  }

  const checkoutRemoved = await deleteByFilter(
    pb,
    'stripe_checkout_sessions',
    `organization = "${organizationId}"`
  )
  if (checkoutRemoved > 0) {
    log(`  Removed ${checkoutRemoved} stripe_checkout_sessions row(s)`)
  }

  const usersRemoved = await deleteByFilter(pb, 'users', `organization = "${organizationId}"`)
  if (usersRemoved > 0) {
    log(`  Removed ${usersRemoved} user(s)`)
  }

  await pb.collection('organizations').delete(organizationId)
}

export async function purgeClosedOrganizations(
  pb: PocketBase,
  options: PurgeClosedOrgsOptions = {}
): Promise<PurgeClosedOrgsResult> {
  assertPurgeForceAllowed(Boolean(options.force))

  const errors: string[] = []
  let organizationsPurged = 0
  const filter = buildClosingOrganizationsFilter(options)

  let dueOrgs
  try {
    dueOrgs = await pb.collection('organizations').getFullList({
      filter,
      fields: 'id,subdomain,status,purge_scheduled_at'
    })
  } catch (error) {
    if (error instanceof ClientResponseError) {
      throw new Error(`Could not list organizations to purge: ${error.message}`)
    }
    throw error
  }

  if (options.organizationId && dueOrgs.length === 0) {
    throw new Error(
      'No matching organization to purge. It must have purge_scheduled_at set'
        + (options.force ? '.' : ' in the past (or use --force).')
    )
  }

  for (const org of dueOrgs) {
    try {
      console.log(`Purging organization ${org.id} (${String(org.subdomain || '')})…`)
      await purgeOrganizationData(pb, org.id, msg => console.log(msg))
      organizationsPurged += 1
      console.log(`Purged closed organization ${org.id} (${String(org.subdomain || '')})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${org.id}: ${message}`)
      console.error(`Failed to purge organization ${org.id}:`, error)
    }
  }

  return { organizationsPurged, errors }
}

/** @deprecated Use purgeClosedOrganizations */
export async function purgeDueClosedOrganizations(
  pb: PocketBase,
  now: Date = new Date()
): Promise<PurgeClosedOrgsResult> {
  return purgeClosedOrganizations(pb, { now })
}

export function assertDevTenantResetAllowed(): void {
  if (process.env.NODE_ENV === 'production' && process.env.RESET_DEV_ALLOW !== 'true') {
    throw new Error(
      'Dev tenant reset is disabled in production. Set RESET_DEV_ALLOW=true to override.'
    )
  }
}

/**
 * Delete every organization and dependent data, then remove leftover app users and checkout rows.
 * PocketBase superuser accounts are not touched.
 */
export async function resetDevTenants(pb: PocketBase): Promise<PurgeClosedOrgsResult> {
  assertDevTenantResetAllowed()

  const errors: string[] = []
  let organizationsPurged = 0

  const orgs = await pb.collection('organizations').getFullList({
    fields: 'id,subdomain'
  })

  console.log(`Found ${orgs.length} organization(s) to remove.`)

  for (const org of orgs) {
    try {
      console.log(`Removing organization ${org.id} (${String(org.subdomain || '')})…`)
      await purgeOrganizationData(pb, org.id, msg => console.log(msg))
      organizationsPurged += 1
      console.log(`Removed organization ${org.id} (${String(org.subdomain || '')})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${org.id}: ${message}`)
      console.error(`Failed to remove organization ${org.id}:`, error)
    }
  }

  const orphanUsers = await pb.collection('users').getFullList({ fields: 'id,email' })
  for (const user of orphanUsers) {
    try {
      await pb.collection('users').delete(user.id)
      console.log(`Removed user ${user.id} (${String(user.email || '')})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`user ${user.id}: ${message}`)
    }
  }

  const checkoutSessions = await deleteByFilter(pb, 'stripe_checkout_sessions', 'id != ""')
  if (checkoutSessions > 0) {
    console.log(`Removed ${checkoutSessions} stripe_checkout_sessions row(s)`)
  }

  return { organizationsPurged, errors }
}
