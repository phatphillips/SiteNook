import type { H3Event } from 'h3'
import type { AnalyticsProvider } from '~/types/sitenook'
import { getPbAdmin } from '../pbAdmin'
import { decryptCredentials, encryptCredentials } from './crypto'
import { getAnalyticsAdapter, getGa4OAuthConfig } from './index'
import {
  AnalyticsProviderError,
  lastCompleteUtcRange,
  type ProviderCredentials
} from './types'
import { buildCredentialsMeta, defaultNextSyncAt, logAnalyticsActivity } from './connections'

const RETENTION_DAYS = 90

export async function syncAnalyticsConnection(
  event: H3Event | undefined,
  connectionId: string,
  options: { actorId?: string | null } = {}
) {
  const pb = await getPbAdmin(event)
  const connection = await pb.collection('analytics_connections').getOne(connectionId)
  if (connection.status === 'disconnected') {
    return { ok: false, skipped: true as const }
  }

  const provider = connection.provider as AnalyticsProvider
  const adapter = getAnalyticsAdapter(provider)
  const oauth = getGa4OAuthConfig(event)

  let credentials = decryptCredentials<ProviderCredentials>(
    String(connection.credentials_encrypted || ''),
    oauth.encryptionKey || undefined
  )

  if (provider === 'ga4') {
    credentials = {
      ...credentials,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret
    }
  }

  const range = lastCompleteUtcRange(28)
  const intervalHours = Number(connection.sync_interval_hours) || 12

  try {
    if (adapter.refreshCredentials && credentials.refreshToken) {
      const refreshed = await adapter.refreshCredentials(credentials)
      credentials = { ...credentials, ...refreshed }
      await pb.collection('analytics_connections').update(connectionId, {
        credentials_encrypted: encryptCredentials(credentials, oauth.encryptionKey || undefined),
        credentials_meta: buildCredentialsMeta(provider, credentials, connection.credentials_meta || {})
      })
    }

    const summary = await adapter.fetchSummary(credentials, range)

    const startIso = `${range.start}T00:00:00.000Z`
    const endIso = `${range.end}T00:00:00.000Z`
    const existing = await pb.collection('analytics_snapshots').getList(1, 1, {
      filter: `connection = "${connectionId}" && range_start = "${startIso}" && range_end = "${endIso}" && granularity = 'range'`
    }).catch(() => ({ items: [] as any[] }))

    const snapshotPayload = {
      organization: connection.organization,
      site: connection.site,
      connection: connectionId,
      range_start: startIso,
      range_end: endIso,
      granularity: 'range',
      metrics: summary
    }

    if (existing.items[0]?.id) {
      await pb.collection('analytics_snapshots').update(existing.items[0].id, snapshotPayload)
    } else {
      await pb.collection('analytics_snapshots').create(snapshotPayload)
    }

    await pb.collection('analytics_connections').update(connectionId, {
      status: 'connected',
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'ok',
      last_error: '',
      next_sync_at: defaultNextSyncAt(intervalHours)
    })

    await purgeOldSnapshots(pb, connectionId)

    return { ok: true as const, summary }
  } catch (error) {
    const kind =
      error instanceof AnalyticsProviderError ? error.kind : 'provider_error'
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Sync failed'

    const patch: Record<string, unknown> = {
      last_sync_status: kind,
      last_error: message,
      next_sync_at: defaultNextSyncAt(kind === 'rate_limited' ? Math.max(intervalHours, 24) : intervalHours)
    }

    if (kind === 'auth_error') {
      patch.status = 'needs_reconnect'
      await logAnalyticsActivity(event as H3Event, {
        organizationId: String(connection.organization),
        actorId: options.actorId || null,
        action: 'analytics_sync_needs_reconnect',
        details: {
          provider,
          siteId: connection.site,
          connectionId
        }
      })
    } else if (connection.status === 'connected') {
      patch.status = 'error'
    }

    await pb.collection('analytics_connections').update(connectionId, patch)
    return { ok: false as const, error: message, kind }
  }
}

async function purgeOldSnapshots(pb: any, connectionId: string) {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS)
  try {
    const old = await pb.collection('analytics_snapshots').getList(1, 50, {
      filter: `connection = "${connectionId}" && range_end < "${cutoff.toISOString()}"`
    })
    for (const row of old.items) {
      await pb.collection('analytics_snapshots').delete(row.id)
    }
  } catch {
    // best-effort retention
  }
}

export async function runAnalyticsSyncTick(event?: H3Event) {
  const pb = await getPbAdmin(event)
  const now = new Date().toISOString()
  const due = await pb.collection('analytics_connections').getList(1, 20, {
    filter: `status = 'connected' && (next_sync_at = '' || next_sync_at <= "${now}")`,
    sort: 'next_sync_at'
  })

  const results = []
  for (const row of due.items) {
    results.push(await syncAnalyticsConnection(event, row.id))
  }
  return results
}
