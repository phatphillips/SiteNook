/**
 * Smoke test: login + GET /api/sites/:id/accessibility/issues
 * Usage: node scripts/test-issues-api.mjs [siteId]
 */
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const WEB_URL = process.env.WEB_URL || 'http://127.0.0.1:3000'
const EMAIL = process.env.TEST_EMAIL || process.env.APP_USER_EMAIL
const PASS = process.env.TEST_PASSWORD || process.env.APP_USER_PASSWORD
const SITE_ID = process.argv[2]

if (!EMAIL || !PASS) {
  console.error('Set APP_USER_EMAIL and APP_USER_PASSWORD (or TEST_EMAIL / TEST_PASSWORD)')
  process.exit(1)
}

const pb = new PocketBase(PB_URL)
const auth = await pb.collection('users').authWithPassword(EMAIL, PASS)
console.log('Logged in as:', auth.record.email, 'org:', auth.record.organization)

const sites = await pb.collection('sites').getFullList({ fields: 'id,name' })
console.log('Sites:', sites.map(s => `${s.name} (${s.id})`).join(', '))

const siteId = SITE_ID || sites[0]?.id
if (!siteId) {
  console.error('No sites found')
  process.exit(1)
}

const token = pb.authStore.token
const url = `${WEB_URL}/api/sites/${siteId}/accessibility/issues?statuses=open&page=1&perPage=20`
console.log('GET', url)

const started = Date.now()
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
})
const elapsed = Date.now() - started
const body = await res.text()

console.log('Status:', res.status, `(${elapsed}ms)`)
if (!res.ok) {
  console.log(body.slice(0, 500))
  process.exit(1)
}

const data = JSON.parse(body)
const sampleRule = data.items?.[0]?.rule_id
const sampleStats = sampleRule ? data.ruleStats?.[sampleRule] : null
console.log(JSON.stringify({
  items: data.items?.length,
  total: data.total,
  openUniqueCount: data.openUniqueCount,
  openOccurrencesCount: data.openOccurrencesCount,
  source: data.source,
  sampleRule,
  sampleStats
}, null, 2))
