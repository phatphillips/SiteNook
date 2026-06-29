import '../config/loadEnv.js'
import { authenticateAdmin, getPocketBase } from '../db/pocketbaseClient.js'

await authenticateAdmin()
const pb = getPocketBase()

const home = await pb.collection('pages').getOne('592t1t42iv8ve60', { fields: 'url,html_snapshot' })
const html = String(home.html_snapshot || '')
console.log('Homepage', home.url, 'html length', html.length)
for (const pat of ['decyp.tas.gov', 'http://decyp', 'https://www.decyp', 'decyp.tas', 'href="http://decyp']) {
  console.log(pat, html.toLowerCase().includes(pat.toLowerCase()))
}

const rows = await pb.collection('qa_broken_links').getList(1, 10, {
  filter: 'href ~ "decyp"',
  expand: 'page',
  fields: 'id,href,page'
})

for (const row of rows.items) {
  console.log('href:', row.href)
  console.log('  page id:', row.page)
  const pageId = typeof row.page === 'string' ? row.page : ''
  if (!pageId) continue
  try {
    const full = await pb.collection('pages').getOne(pageId, { fields: 'url,html_snapshot' })
    const html = String(full.html_snapshot || '')
    console.log('  from page:', full.url)
    console.log('  html has decyp.tas.gov.au:', html.toLowerCase().includes('decyp.tas.gov.au'))
    const hrefMatch = html.match(/href=["'][^"']*decyp[^"']*["']/gi)
    console.log('  href attrs:', hrefMatch?.slice(0, 3))
  } catch (e) {
    console.log('  page missing (retention pruned?)')
  }
  console.log('')
}
