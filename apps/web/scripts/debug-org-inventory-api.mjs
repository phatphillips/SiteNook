/**
 * Time org inventory query paths. Usage:
 *   node scripts/debug-org-inventory-api.mjs [siteId] [tab]
 */
import PocketBase from 'pocketbase'

const pbUrl = process.env.NUXT_POCKETBASE_URL || 'http://localhost:8090'
const email = process.env.NUXT_PB_ADMIN_EMAIL
const password = process.env.NUXT_PB_ADMIN_PASSWORD
const siteId = process.argv[2]
const tab = process.argv[3] || 'images'

const IMAGE_PATH = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?|$)/i

function pbOr(clauses) {
  const parts = clauses.filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0]
  return parts.map(c => `(${c})`).join(' || ')
}

function pbRelation(field, id) {
  return `${field} = "${id}"`
}

function isImage(item) {
  if (item.is_pdf) return false
  if (String(item.mime_type || '').startsWith('image/')) return true
  return IMAGE_PATH.test(item.url)
}

function isPdf(item) {
  return Boolean(item.is_pdf) || item.url?.toLowerCase().includes('.pdf')
}

function isFile(item) {
  return !isPdf(item) && !isImage(item)
}

const pb = new PocketBase(pbUrl)
await pb.collection('_superusers').authWithPassword(email, password)

const orgFilter = siteId ? `id = "${siteId}"` : ''
const sites = await pb.collection('sites').getFullList({
  filter: orgFilter,
  fields: 'id,name',
  sort: 'name'
})

const scanIds = []
for (const site of sites) {
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${site.id}" && status = "complete"`,
    sort: '-completed_at',
    fields: 'id',
    limit: 1
  })
  if (scans[0]?.id) scanIds.push(scans[0].id)
}

const scanFilter = pbOr(scanIds.map(id => pbRelation('scan', id)))
console.log({ sites: sites.length, scanIds: scanIds.length, tab, filterLen: scanFilter.length })

const imageFilter = `(${['.jpg','.jpeg','.png','.gif','.webp','.svg','.avif','.bmp','.ico'].map(s => `url ~ '${s}'`).join(' || ')} || mime_type ~ 'image/')`

const t0 = Date.now()
const raw = await pb.collection('qa_inventory').getFullList({
  filter: `${scanFilter} && ${imageFilter}`,
  fields: 'id,url,scan,size_bytes,mime_type,content_type,is_pdf',
  sort: 'url'
})
console.log(`getFullList (PB image filter): ${raw.length} rows in ${Date.now() - t0}ms`)

const t1 = Date.now()
const filtered = tab === 'images' ? raw.filter(isImage)
  : tab === 'files' ? raw.filter(isFile)
    : tab === 'pdfs' ? raw.filter(isPdf)
      : raw
console.log(`filter ${tab}: ${filtered.length} rows in ${Date.now() - t1}ms`)
