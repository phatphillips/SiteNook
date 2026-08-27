import PocketBase from 'pocketbase'

const pbUrl = process.env.NUXT_POCKETBASE_URL || 'http://127.0.0.1:8090'
const email = process.env.NUXT_PB_ADMIN_EMAIL
const password = process.env.NUXT_PB_ADMIN_PASSWORD
const siteId = process.argv[2] || 'h2np44z48g96c0r'
const assetUrl = process.argv[3] || 'https://www.google-analytics.com/analytics.js'

const pb = new PocketBase(pbUrl)
await pb.collection('_superusers').authWithPassword(email, password)

const scans = await pb.collection('scans').getFullList({
  filter: `site = "${siteId}" && (status = 'complete' || status = 'complete_with_errors' || status = 'running')`,
  fields: 'id,status,completed_at,started_at,created'
})
scans.sort((a, b) => String(b.completed_at ?? b.started_at ?? '').localeCompare(String(a.completed_at ?? a.started_at ?? '')))
const scanId = scans[0]?.id
console.log('siteId', siteId, 'scanId', scanId)

const refs = await pb.collection('qa_inventory_refs').getFullList({
  filter: `scan = "${scanId}" && asset_url = "${assetUrl}"`,
  fields: 'page'
})
console.log('refs count', refs.length)
if (!refs.length) process.exit(0)

const pageIds = [...new Set(refs.map(ref => ref.page))]
const pages = await pb.collection('pages').getFullList({
  filter: pageIds.map(id => `id = "${id}"`).join(' || '),
  fields: 'id,url,title'
})
console.log('pages loaded', pages.length)
for (const page of pages.slice(0, 3)) {
  console.log('-', page.title || page.url, page.url)
}
