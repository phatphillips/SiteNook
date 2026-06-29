import '../src/config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../src/db/pocketbaseClient.js'

await authenticateAdmin()
const pb = getPocketBase()

const sites = await pb.collection('sites').getFullList({ fields: 'id,name,url' })
for (const site of sites) {
  if (!String(site.url || '').includes('anything.tas.gov')) continue
  console.log('Site:', site.name, site.id)

  const pages = await pb.collection('pages').getFullList({
    filter: `site = "${site.id}"`,
    fields: 'id,url,html_snapshot,scan',
    sort: '-created'
  })

  let withDecyp = 0
  for (const page of pages) {
    const html = String(page.html_snapshot || '')
    const hrefs = [...html.matchAll(/href=["']([^"']*)["']/gi)].map(m => m[1]).filter(h => /decyp\.tas\.gov/i.test(h))
    if (hrefs.length || html.toLowerCase().includes('decyp.tas.gov')) {
      withDecyp++
      console.log(' ', page.url)
      console.log('   hrefs:', hrefs.slice(0, 5))
    }
  }
  console.log('PB pages with decyp.tas.gov:', withDecyp, 'of', pages.length)
}
