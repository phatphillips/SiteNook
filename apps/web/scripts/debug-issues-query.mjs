import PocketBase from 'pocketbase'
import { latestPageIdsByNormalizedUrl } from '../app/utils/pageUrl.js'

const PB_URL = 'http://127.0.0.1:8090'
const EMAIL = process.env.APP_USER_EMAIL
const PASS = process.env.APP_USER_PASSWORD
const SITE_ID = process.argv[2] || 'h2np44z48g96c0r'

const pb = new PocketBase(PB_URL)
await pb.collection('users').authWithPassword(EMAIL, PASS)

const pages = await pb.collection('pages').getFullList({
  filter: `site = "${SITE_ID}"`,
  expand: 'scan',
  fields: 'id,url,title,scan,site,created'
})

function pageTs(page) {
  const scan = page.expand?.scan
  if (scan) {
    const raw = scan.completed_at ?? scan.started_at ?? scan.created
    if (raw) {
      const ms = Date.parse(String(raw))
      if (Number.isFinite(ms)) return ms
    }
  }
  if (page.created) {
    const ms = Date.parse(page.created)
    if (Number.isFinite(ms)) return ms
  }
  return 0
}

const pageIds = latestPageIdsByNormalizedUrl(
  pages.map(p => ({ id: p.id, url: p.url, ts: pageTs(p) }))
)
console.log('pages:', pages.length, 'latest ids:', pageIds.size)

const batches = []
const ids = [...pageIds]
for (let i = 0; i < ids.length; i += 80) batches.push(ids.slice(i, i + 80))

let total = 0
for (const batch of batches) {
  const filter = batch.map(id => `page = "${id}"`).join(' || ')
  const issues = await pb.collection('accessibility_issues').getFullList({ filter, fields: 'id,status' })
  total += issues.length
  console.log('batch', batch.length, 'pages ->', issues.length, 'issues')
}
console.log('total via page batches:', total)

const viaScan = await pb.collection('accessibility_issues').getFullList({
  filter: `scan.site = "${SITE_ID}"`,
  fields: 'id,page,status'
})
const latestOnly = viaScan.filter(i => pageIds.has(i.page))
console.log('via scan.site total:', viaScan.length, 'latest pages only:', latestOnly.length, 'open:', latestOnly.filter(i => i.status === 'open').length)
