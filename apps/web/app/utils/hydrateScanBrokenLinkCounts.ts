import type PocketBase from 'pocketbase'
import type { Scan } from '~/types/sitenook'

/**
 * Fill missing `broken_link_count` on historical scans by counting non-dismissed
 * `qa_broken_links` rows. Scans that already have the field are left unchanged.
 */
export async function hydrateScanBrokenLinkCounts(
  pb: PocketBase,
  scans: Scan[]
): Promise<Scan[]> {
  const missing = scans.filter(
    scan => scan.id && (scan.broken_link_count == null || Number.isNaN(scan.broken_link_count))
  )
  if (!missing.length) return scans

  const entries = await Promise.all(
    missing.map(async (scan) => {
      const result = await pb.collection('qa_broken_links').getList(1, 1, {
        filter: `scan = "${scan.id}" && status != "dismissed"`,
        fields: 'id'
      })
      return [scan.id, result.totalItems] as const
    })
  )
  const counts = new Map(entries)

  return scans.map((scan) => {
    if (scan.broken_link_count != null && !Number.isNaN(scan.broken_link_count)) return scan
    const count = counts.get(scan.id)
    if (count == null) return scan
    return { ...scan, broken_link_count: count }
  })
}
