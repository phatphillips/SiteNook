import Typesense from 'typesense'

const client = new Typesense.Client({
  nodes: [{ host: 'typesense', port: 8108, protocol: 'http' }],
  apiKey: process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10
})

let page = 1
let count = 0
for (;;) {
  const batch = await client.collections('search_documents').documents().search({
    q: 'tas.gov.au',
    query_by: 'body,url',
    filter_by: 'type:=webpage',
    infix: 'always',
    per_page: 50,
    page
  })
  for (const hit of batch.hits ?? []) {
    const body = hit.document.body || ''
    const hrefs = [...body.matchAll(/href=["']([^"']*)["']/gi)].map(m => m[1]).filter(h => /decyp/i.test(h))
    if (hrefs.length || body.toLowerCase().includes('decyp.tas.gov')) {
      count++
      console.log(hit.document.url)
      console.log('  hrefs:', hrefs.slice(0, 5))
    }
  }
  if (!batch.hits?.length || batch.hits.length < 50) break
  page++
}
console.log('pages with decyp.tas.gov in html:', count)
