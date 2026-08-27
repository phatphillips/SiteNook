import { loadScannerEnv } from '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'

loadScannerEnv()

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

async function main() {
  await authenticateAdmin()
  const pb = getPocketBase()

  const summaries = await pb.collection('site_dashboard_summary').getFullList({
    fields: 'site,open_a11y_count,open_qa_count,open_seo_count'
  }) as Array<{ site: string, open_a11y_count?: number, open_qa_count?: number, open_seo_count?: number }>

  let mismatches = 0
  for (const summary of summaries) {
    const scans = await pb.collection('scans').getList(1, 1, {
      filter: `site = "${summary.site}" && (status = "complete" || status = "complete_with_errors")`,
      sort: '-completed_at,-started_at',
      fields: 'id,open_issue_count'
    })
    const latest = scans.items[0] as { id?: string, open_issue_count?: number } | undefined
    if (!latest?.id) continue
    const [broken, spelling, seo] = await Promise.all([
      pb.collection('qa_broken_links').getList(1, 1, { filter: `scan = "${latest.id}" && status != "dismissed"`, fields: 'id' }),
      pb.collection('qa_spelling').getList(1, 1, { filter: `scan = "${latest.id}" && status = "open"`, fields: 'id' }),
      pb.collection('seo_issues').getList(1, 1, { filter: `scan = "${latest.id}" && status = "open"`, fields: 'id' })
    ])

    const expectedA11y = toNumber(latest.open_issue_count)
    const expectedQa = broken.totalItems + spelling.totalItems
    const expectedSeo = seo.totalItems
    if (
      expectedA11y !== toNumber(summary.open_a11y_count)
      || expectedQa !== toNumber(summary.open_qa_count)
      || expectedSeo !== toNumber(summary.open_seo_count)
    ) {
      mismatches++
      console.log(`Mismatch for site ${summary.site}: expected a11y=${expectedA11y}, qa=${expectedQa}, seo=${expectedSeo}`)
    }
  }

  if (mismatches > 0) {
    console.error(`Parity verification failed with ${mismatches} mismatch(es).`)
    process.exit(1)
  }
  console.log('Parity verification passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
