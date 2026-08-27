import type PocketBase from 'pocketbase'
import PQueue from 'p-queue'
import { normalizeInventoryUrl } from './inventoryUrl.js'

const TIMEOUT_MS = 8000
const FETCH_CONCURRENCY = 12

const sizeCache = new Map<string, number>()

export function clearInventorySizeCache(): void {
  sizeCache.clear()
}

export function parseContentLength(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function parseTotalFromContentRange(value: string | null | undefined): number {
  if (!value) return 0
  const match = value.match(/\/(\d+)\s*$/)
  if (!match) return 0
  return parseContentLength(match[1])
}

async function tryHeadSize(url: string): Promise<number> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)
    return parseContentLength(response.headers.get('content-length'))
  } catch {
    return 0
  }
}

async function tryRangeGetSize(url: string): Promise<number> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
      redirect: 'follow'
    })
    clearTimeout(timeout)

    const total = parseTotalFromContentRange(response.headers.get('content-range'))
    if (total > 0) return total

    return parseContentLength(response.headers.get('content-length'))
  } catch {
    return 0
  }
}

export async function fetchResourceSizeBytes(url: string): Promise<number> {
  const cached = sizeCache.get(url)
  if (cached !== undefined) return cached

  const fromHead = await tryHeadSize(url)
  const size = fromHead > 0 ? fromHead : await tryRangeGetSize(url)
  sizeCache.set(url, size)
  return size
}

export async function resolveInventoryItemSizes<T extends { url: string, size_bytes: number }>(
  items: T[]
): Promise<T[]> {
  if (!items.length) return items

  const queue = new PQueue({ concurrency: FETCH_CONCURRENCY })
  return Promise.all(
    items.map(item => queue.add(async () => ({
      ...item,
      size_bytes: item.size_bytes > 0
        ? item.size_bytes
        : await fetchResourceSizeBytes(item.url)
    })) as Promise<T>)
  )
}

export async function enrichScanInventorySizes(pb: PocketBase, scanId: string): Promise<void> {
  const records = await pb.collection('qa_inventory').getFullList({
    filter: `scan = "${scanId}" && size_bytes = 0`,
    fields: 'id,url,size_bytes'
  })
  if (!records.length) return

  clearInventorySizeCache()

  const urlToIds = new Map<string, string[]>()
  for (const record of records) {
    const url = normalizeInventoryUrl(String(record.url ?? ''))
    if (!url) continue
    const ids = urlToIds.get(url) ?? []
    ids.push(String(record.id))
    urlToIds.set(url, ids)
  }

  const queue = new PQueue({ concurrency: FETCH_CONCURRENCY })
  await Promise.all(
    [...urlToIds.entries()].map(([url, ids]) => queue.add(async () => {
      const size = await fetchResourceSizeBytes(url)
      if (size <= 0) return
      await Promise.all(
        ids.map(id => pb.collection('qa_inventory').update(id, { size_bytes: size }))
      )
    }))
  )
}
