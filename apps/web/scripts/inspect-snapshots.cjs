const PocketBaseModule = require('pocketbase')
const PocketBase = PocketBaseModule.default || PocketBaseModule

async function main() {
  const pb = new PocketBase('http://pocketbase:8090')
  const email = process.env.NUXT_PB_ADMIN_EMAIL || process.env.PB_ADMIN_EMAIL
  const password = process.env.NUXT_PB_ADMIN_PASSWORD || process.env.PB_ADMIN_PASSWORD
  console.log('auth as', email)
  try {
    await pb.collection('_superusers').authWithPassword(email, password)
  } catch (e) {
    console.error('auth failed', e && e.message ? e.message : e)
    process.exit(1)
  }

  const pages = await pb.collection('pages').getList(1, 8, {
    fields: 'id,url,title,html_size_bytes,html_snapshot,site',
    sort: '-html_size_bytes'
  })

  for (const p of pages.items) {
    const snap = String(p.html_snapshot || '')
    console.log(JSON.stringify({
      id: p.id,
      site: p.site,
      url: p.url,
      title: p.title,
      size: p.html_size_bytes,
      snapLen: snap.length,
      head: snap.slice(0, 180).replace(/\s+/g, ' '),
      hasHtml: /<html/i.test(snap),
      hasBody: /<body/i.test(snap),
      hasContent: /<(p|h1|h2|article|main|section)\b/i.test(snap)
    }))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
