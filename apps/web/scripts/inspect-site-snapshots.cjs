const PocketBaseModule = require('pocketbase')
const PocketBase = PocketBaseModule.default || PocketBaseModule

async function main() {
  const pb = new PocketBase('http://pocketbase:8090')
  await pb.collection('_superusers').authWithPassword(
    process.env.NUXT_PB_ADMIN_EMAIL,
    process.env.NUXT_PB_ADMIN_PASSWORD
  )
  const site = process.argv[2] || 'h2np44z48g96c0r'
  const pages = await pb.collection('pages').getList(1, 20, {
    filter: `site="${site}"`,
    fields: 'id,url,title,html_size_bytes,html_snapshot',
    sort: '-html_size_bytes'
  })
  let withBody = 0
  let without = 0
  for (const p of pages.items) {
    const s = String(p.html_snapshot || '')
    const bodyIdx = s.search(/<body/i)
    if (bodyIdx >= 0) withBody++
    else without++
    console.log(JSON.stringify({
      id: p.id,
      url: p.url,
      size: p.html_size_bytes,
      snap: s.length,
      bodyIdx,
      hasBody: bodyIdx >= 0
    }))
  }
  console.log('summary', { withBody, without, total: pages.items.length })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
