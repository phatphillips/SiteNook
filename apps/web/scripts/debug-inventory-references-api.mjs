/**
 * Call inventory references API with an app user token (mirrors browser orgApiFetch).
 *
 * Usage:
 *   node scripts/debug-inventory-references-api.mjs [siteId] [assetUrl] [userEmail] [userPassword]
 */
import PocketBase from 'pocketbase'

const pbUrl = process.env.NUXT_POCKETBASE_URL || 'http://127.0.0.1:8090'
const webUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
const siteId = process.argv[2] || 'h2np44z48g96c0r'
const assetUrl = process.argv[3] || 'http://decyp.tas.gov.au/'
const userEmail = process.argv[4] || process.env.APP_USER_EMAIL || 'minimojo089@gmail.com'
const userPassword = process.argv[5] || process.env.APP_USER_PASSWORD

if (!userPassword) {
  console.error('Set APP_USER_PASSWORD or pass password as argv[5]')
  process.exit(1)
}

const pb = new PocketBase(pbUrl)
await pb.collection('users').authWithPassword(userEmail, userPassword)

const url = new URL('/api/org/qa/inventory/references', webUrl)
url.searchParams.set('siteId', siteId)
url.searchParams.set('url', assetUrl)

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${pb.authStore.token}` }
})

console.log('status', response.status)
const body = await response.json()
console.log('pages', body.pages?.length ?? 0)
if (body.pages?.[0]) console.log('first', body.pages[0])
