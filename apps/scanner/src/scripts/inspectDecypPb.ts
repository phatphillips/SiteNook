import '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'

await authenticateAdmin()
const pb = getPocketBase()

for (const collection of ['qa_inventory', 'qa_broken_links', 'pages']) {
  try {
    const rows = await pb.collection(collection).getList(1, 50, {
      filter: 'url ~ "decyp" || href ~ "decyp"',
      fields: 'id,url,href,scan,site'
    }).catch(() => pb.collection(collection).getList(1, 50, { filter: 'url ~ "decyp"', fields: 'id,url,scan,site' }))
    console.log(collection, 'matches:', rows.items.length)
    for (const row of rows.items.slice(0, 5)) {
      console.log(' ', row)
    }
  } catch (e) {
    const rows = await pb.collection(collection).getList(1, 100, { fields: 'id,url,href' })
    const hits = rows.items.filter((r: { url?: string, href?: string }) =>
      String(r.url || r.href || '').toLowerCase().includes('decyp'))
    console.log(collection, 'manual decyp hits:', hits.length)
    for (const row of hits.slice(0, 5)) console.log(' ', row.url || row.href)
  }
}
