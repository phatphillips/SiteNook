import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const EMAIL = process.env.TEST_EMAIL || process.env.APP_USER_EMAIL
const PASS = process.env.TEST_PASSWORD || process.env.APP_USER_PASSWORD
const SITE_ID = process.argv[2] || 'h2np44z48g96c0r'

const pb = new PocketBase(PB_URL)
await pb.collection('users').authWithPassword(EMAIL, PASS)

const pages = await pb.collection('pages').getFullList({
  filter: `site = "${SITE_ID}"`,
  expand: 'scan',
  fields: 'id,url,scan,site,created'
})
console.log('pages as user:', pages.length)

const viaScanSite = await pb.collection('accessibility_issues').getFullList({
  filter: `scan.site = "${SITE_ID}" && status = 'open'`,
  fields: 'id,page,rule_id'
})
console.log('open issues via scan.site:', viaScanSite.length)

if (pages.length) {
  const pageIds = pages.slice(0, 5).map(p => p.id)
  const orFilter = pageIds.map(id => `page = "${id}"`).join(' || ')
  const batch = await pb.collection('accessibility_issues').getFullList({
    filter: orFilter,
    fields: 'id'
  })
  console.log('issues for first 5 pages:', batch.length)
}
