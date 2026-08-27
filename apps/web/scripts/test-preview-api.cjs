const PocketBaseModule = require('pocketbase')
const PocketBase = PocketBaseModule.default || PocketBaseModule

async function main() {
  const pb = new PocketBase('http://pocketbase:8090')
  const email = process.env.APP_USER_EMAIL || process.env.NUXT_PB_ADMIN_EMAIL
  const password = process.env.APP_USER_PASSWORD || process.env.NUXT_PB_ADMIN_PASSWORD

  // Prefer app user; fall back to listing users via admin
  let token = ''
  try {
    const auth = await pb.collection('users').authWithPassword(email, password)
    token = auth.token
    console.log('authed as user', auth.record.email)
  } catch {
    await pb.collection('_superusers').authWithPassword(
      process.env.NUXT_PB_ADMIN_EMAIL,
      process.env.NUXT_PB_ADMIN_PASSWORD
    )
    const users = await pb.collection('users').getList(1, 1)
    if (!users.items.length) throw new Error('no users')
    // Impersonation not available — create password auth via email from env APP_USER
    throw new Error('Need APP_USER credentials for API test; admin only')
  }

  const siteId = 'h2np44z48g96c0r'
  const pageId = '6v2040xl3a8sgz0'
  const url = `http://127.0.0.1:3000/api/sites/${siteId}/accessibility/simulator/preview?pageId=${pageId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  console.log('api status', res.status)
  console.log(text.slice(0, 500))
  if (res.ok) {
    const json = JSON.parse(text)
    console.log({
      source: json.source,
      htmlLen: json.html?.length,
      hasBody: /<body/i.test(json.html || ''),
      hasContent: /<(p|h1|main|section)\b/i.test(json.html || '')
    })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
