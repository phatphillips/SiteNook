import type PocketBase from 'pocketbase'
import type { Scan } from '~/types/sitenook'
import { countCollection } from '~/utils/pbCollectionCount'
import { pbAnd, pbRelation, pbSelect } from '~/utils/pbFilter'

const HYDRATE_BATCH_SIZE = 16

/**
 * Attach `open_seo_count` from `seo_issues` so org/site SEO trends can chart
 * open findings over time. Counts are not stored on the scan record.
 */
export async function hydrateScanSeoIssueCounts(
  pb: PocketBase,
  scans: Scan[]
): Promise<Scan[]> {
  const missing = scans.filter(scan => scan.id && scan.open_seo_count == null)
  if (!missing.length) return scans

  const counts = new Map<string, number>()
  for (let i = 0; i < missing.length; i += HYDRATE_BATCH_SIZE) {
    const batch = missing.slice(i, i + HYDRATE_BATCH_SIZE)
    const entries = await Promise.all(
      batch.map(async (scan) => {
        const total = await countCollection(
          pb,
          'seo_issues',
          pbAnd([pbRelation('scan', scan.id), pbSelect('status', 'open')])
        )
        return [scan.id, total] as const
      })
    )
    for (const [id, total] of entries) counts.set(id, total)
  }

  return scans.map((scan) => {
    if (scan.open_seo_count != null) return scan
    const count = counts.get(scan.id)
    if (count == null) return scan
    return { ...scan, open_seo_count: count }
  })
}
