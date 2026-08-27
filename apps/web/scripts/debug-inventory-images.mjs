/**
 * Debug inventory images tab performance. Usage (from apps/web):
 *   node scripts/debug-inventory-images.mjs
 */
import PocketBase from 'pocketbase'

const pbUrl = process.env.NUXT_POCKETBASE_URL || 'http://localhost:8090'
const email = process.env.NUXT_PB_ADMIN_EMAIL
const password = process.env.NUXT_PB_ADMIN_PASSWORD

if (!email || !password) {
  console.error('Set NUXT_PB_ADMIN_EMAIL and NUXT_PB_ADMIN_PASSWORD')
  process.exit(1)
}

const pb = new PocketBase(pbUrl)
await pb.collection('_superusers').authWithPassword(email, password)

const sites = await pb.collection('sites').getFullList({ fields: 'id,name', sort: 'name' })
console.log('sites:', sites.length)

for (const site of sites.slice(0, 3)) {
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${site.id}" && status = "complete"`,
    sort: '-completed_at',
    fields: 'id',
    limit: 1
  })
  const scanId = scans[0]?.id
  if (!scanId) continue

  const t0 = Date.now()
  const total = await pb.collection('qa_inventory').getList(1, 1, {
    filter: `scan = "${scanId}"`,
    fields: 'id'
  })
  console.log(`\n${site.name} (${site.id}) scan ${scanId}: total qa_inventory=${total.totalItems}`)

  for (const [label, filter] of [
    ['all', `scan = "${scanId}"`],
    ['images mime', `scan = "${scanId}" && mime_type ~ 'image/'`],
    ['images jpg', `scan = "${scanId}" && url ~ '.jpg'`],
    ['images png', `scan = "${scanId}" && url ~ '.png'`]
  ]) {
    const r = await pb.collection('qa_inventory').getList(1, 1, { filter, fields: 'id' })
    console.log(`  ${label}: ${r.totalItems}`)
  }

  const t1 = Date.now()
  const all = await pb.collection('qa_inventory').getFullList({
    filter: `scan = "${scanId}"`,
    fields: 'id,url,mime_type,is_pdf',
    sort: 'url'
  })
  console.log(`  getFullList all: ${all.length} rows in ${Date.now() - t1}ms`)

  const imageExt = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?|$)/i
  const images = all.filter(r => String(r.mime_type || '').startsWith('image/') || imageExt.test(r.url))
  console.log(`  JS image filter: ${images.length} rows`)
  console.log(`  site total elapsed: ${Date.now() - t0}ms`)
}
