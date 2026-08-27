import PocketBase from 'pocketbase'

const pb = new PocketBase(process.env.NUXT_POCKETBASE_URL || 'http://localhost:8090')
await pb.collection('_superusers').authWithPassword(
  process.env.NUXT_PB_ADMIN_EMAIL,
  process.env.NUXT_PB_ADMIN_PASSWORD
)

const scanId = 'xb8z489fl993xx5'
const scanFilter = `scan = "${scanId}"`

const imageSuffixes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']
const imageFilter = `(${imageSuffixes.map(s => `url ~ '${s}'`).join(' || ')} || mime_type ~ 'image/')`
const pdfFilter = `(is_pdf = true || url ~ '.pdf')`
const filesFilter = [
  'is_pdf = false',
  `mime_type !~ 'image/'`,
  ...imageSuffixes.map(s => `url !~ '${s}'`)
].join(' && ')

for (const [tab, tabFilter] of [['images', imageFilter], ['pdfs', pdfFilter], ['files', filesFilter]]) {
  const filter = `${scanFilter} && (${tabFilter})`
  try {
    const count = await pb.collection('qa_inventory').getList(1, 1, { filter, fields: 'id' })
    const t0 = Date.now()
    const rows = await pb.collection('qa_inventory').getFullList({ filter, fields: 'id,url', sort: 'url' })
    console.log(`${tab}: count=${count.totalItems} fullList=${rows.length} in ${Date.now() - t0}ms`)
  } catch (e) {
    console.log(`${tab}: ERROR`, e?.response?.data || e.message)
  }
}
