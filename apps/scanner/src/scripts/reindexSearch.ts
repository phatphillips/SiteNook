import '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'
import { isTypesenseEnabled } from '../search/typesenseConfig.js'
import { ensureSearchCollection } from '../search/typesenseClient.js'
import {
  bulkImportSearchDocuments,
  indexPdfFromRecord,
  loadLatestPagesPerUrlKey,
  loadOutboundUrlsByPageIds,
  reconcileSiteWebpageSearchIndex
} from '../search/searchIndexer.js'
import {
  buildWebpageDocument,
  pageTimestampFromScan
} from '../search/searchDocument.js'

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find(arg => arg.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined
}

async function loadSites(orgId?: string, siteId?: string) {
  const pb = getPocketBase()
  const filters: string[] = []
  if (siteId) filters.push(`id = "${siteId}"`)
  if (orgId) filters.push(`organization = "${orgId}"`)
  const filter = filters.length ? filters.join(' && ') : undefined
  return pb.collection('sites').getFullList({
    filter,
    fields: 'id,name,organization'
  }) as Promise<Array<{ id: string, name: string, organization: string }>>
}

async function reindexWebpagesForSite(
  site: { id: string, name: string, organization: string }
): Promise<number> {
  const pb = getPocketBase()
  const pages = await loadLatestPagesPerUrlKey(pb, site.id)
  const outboundByPage = await loadOutboundUrlsByPageIds(pb, pages.map(page => ({
    id: page.id,
    url: page.url,
    html_snapshot: page.html_snapshot
  })))
  const docs = pages.map(page => buildWebpageDocument({
    pageId: page.id,
    orgId: site.organization,
    siteId: site.id,
    siteName: site.name,
    url: page.url,
    title: page.title,
    htmlSnapshot: page.html_snapshot,
    outboundLinkUrls: outboundByPage.get(page.id),
    lastScannedAt: pageTimestampFromScan(
      page.expand?.scan?.completed_at,
      page.expand?.scan?.created,
      page.created
    )
  }))

  const BATCH = 200
  for (let i = 0; i < docs.length; i += BATCH) {
    await bulkImportSearchDocuments(docs.slice(i, i + BATCH))
  }

  await reconcileSiteWebpageSearchIndex(site.id)
  return docs.length
}

async function reindexPdfsForSite(siteId: string): Promise<number> {
  const pb = getPocketBase()
  const pdfs = await pb.collection('pdf_documents').getFullList({
    filter: `site = "${siteId}"`,
    fields: 'id,site,url,filename,document_title,text_content,pdf_metadata,validated_at,created'
  }) as Array<{
    id: string
    site: string
    url?: string
    filename?: string
    document_title?: string
    text_content?: string
    pdf_metadata?: Record<string, unknown>
    validated_at?: string
    created?: string
  }>

  let indexed = 0
  for (const pdf of pdfs) {
    if (!String(pdf.text_content ?? '').trim()) continue
    await indexPdfFromRecord(pb, pdf)
    indexed += 1
  }
  return indexed
}

async function main() {
  if (!isTypesenseEnabled()) {
    console.error('Typesense is disabled. Set TYPESENSE_ENABLED=1, TYPESENSE_URL, and TYPESENSE_API_KEY.')
    process.exit(1)
  }

  await authenticateAdmin()
  await ensureSearchCollection()

  const orgId = parseArg('org')
  const siteId = parseArg('site')
  const sites = await loadSites(orgId, siteId)

  if (!sites.length) {
    console.log('No sites matched the filter.')
    return
  }

  let totalPages = 0
  let totalPdfs = 0

  for (const site of sites) {
    console.log(`Reindexing site ${site.name} (${site.id})…`)
    const pages = await reindexWebpagesForSite(site)
    const pdfs = await reindexPdfsForSite(site.id)
    totalPages += pages
    totalPdfs += pdfs
    console.log(`  ${pages} webpage(s), ${pdfs} PDF(s)`)
  }

  console.log(`Done. Indexed ${totalPages} webpage(s) and ${totalPdfs} PDF(s) across ${sites.length} site(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
