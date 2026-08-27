import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'

export type ApiKeyScope = 'read' | 'write'

export const API_KEY_PREFIX = 'ak_'

export interface ApiKeyRecord {
  id: string
  organization: string
  name: string
  key_prefix: string
  key_hash: string
  scopes: ApiKeyScope[]
  created_by?: string
  last_used_at?: string
  revoked_at?: string
  created?: string
  updated?: string
}

export interface ApiKeyPublicMeta {
  id: string
  name: string
  key_prefix: string
  scopes: ApiKeyScope[]
  created_by?: string
  last_used_at?: string | null
  revoked_at?: string | null
  created?: string
  updated?: string
}

export function normalizeScopes(raw: unknown): ApiKeyScope[] {
  const list = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? [raw] : []
  const scopes = new Set<ApiKeyScope>()
  for (const item of list) {
    if (item === 'read' || item === 'write') scopes.add(item)
  }
  if (scopes.has('write')) scopes.add('read')
  if (!scopes.size) scopes.add('read')
  return [...scopes]
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex')
}

export function generateApiKeySecret(): { plaintext: string, prefix: string, hash: string } {
  const secret = randomBytes(24).toString('base64url')
  const plaintext = `${API_KEY_PREFIX}${secret}`
  return {
    plaintext,
    prefix: plaintext.slice(0, 11),
    hash: hashApiKey(plaintext)
  }
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX) && token.length >= 20
}

export function scopesAllowWrite(scopes: ApiKeyScope[]): boolean {
  return scopes.includes('write')
}

export function toPublicApiKey(record: RecordModel | ApiKeyRecord): ApiKeyPublicMeta {
  return {
    id: String(record.id),
    name: String(record.name || ''),
    key_prefix: String(record.key_prefix || ''),
    scopes: normalizeScopes(record.scopes),
    created_by: record.created_by ? String(record.created_by) : undefined,
    last_used_at: record.last_used_at ? String(record.last_used_at) : null,
    revoked_at: record.revoked_at ? String(record.revoked_at) : null,
    created: record.created ? String(record.created) : undefined,
    updated: record.updated ? String(record.updated) : undefined
  }
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length || ba.length === 0) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/** Look up a non-revoked API key by plaintext secret (admin PB client). */
export async function findApiKeyBySecret(
  pb: PocketBase,
  plaintext: string
): Promise<ApiKeyRecord | null> {
  if (!isApiKeyToken(plaintext)) return null
  const hash = hashApiKey(plaintext)
  const prefix = plaintext.slice(0, 11)

  let candidates: RecordModel[] = []
  try {
    // key_prefix is alphanumeric / underscore only (from generateApiKeySecret)
    candidates = await pb.collection('api_keys').getFullList({
      filter: `key_prefix = '${prefix}'`,
      requestKey: null
    })
  } catch {
    return null
  }

  for (const row of candidates) {
    if (row.revoked_at) continue
    if (safeEqualHex(String(row.key_hash || ''), hash)) {
      return {
        id: row.id,
        organization: String(row.organization),
        name: String(row.name || ''),
        key_prefix: String(row.key_prefix || ''),
        key_hash: String(row.key_hash || ''),
        scopes: normalizeScopes(row.scopes),
        created_by: row.created_by ? String(row.created_by) : undefined,
        last_used_at: row.last_used_at ? String(row.last_used_at) : undefined,
        revoked_at: row.revoked_at ? String(row.revoked_at) : undefined,
        created: row.created ? String(row.created) : undefined,
        updated: row.updated ? String(row.updated) : undefined
      }
    }
  }
  return null
}

export async function touchApiKeyLastUsed(pb: PocketBase, keyId: string): Promise<void> {
  try {
    await pb.collection('api_keys').update(keyId, {
      last_used_at: new Date().toISOString()
    })
  } catch {
    // Non-fatal — auth still succeeds
  }
}
