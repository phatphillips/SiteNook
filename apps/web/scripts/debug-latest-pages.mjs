import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const EMAIL = process.env.APP_USER_EMAIL
const PASS = process.env.APP_USER_PASSWORD
const SITE_ID = process.argv[2] || 'h2np44z48g96c0r'

function normalizePageUrl(url) {
  try {
    const u = new URL(url)
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    const host = u.hostname.toLowerCase()
    const defaultPort = u.protocol === 'https:' ? '443' : '80'
    const port = u.port && u.port !== defaultPort ? `:${u.port}` : ''
    return `${u.protocol}//${host}${port}${path}${u.search}${u.hash}`
  } catch {
    const trimmed = String(url ?? '').trim()
    if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.slice(0, -1)
    return trimmed
  }
}

function latestPageIdsByNormalizedUrl(pages) {
  const maxTsByKey = new Map()
  const entries = []
  for (const page of pages) {
    const key = normalizePageUrl(page.url)
    entries.push({ id: page.id, key, ts: page.ts })
    const prev = maxTsByKey.get(key) ?? 0
    if (page.ts >= prev) maxTsByKey.set(key, page.ts)
  }
  const allowed = new Set()
  for (const { id, key, ts } of entries) {
    if (ts === maxTsByKey.get(key)) allowed.add(id)
  }
  return allowed
}

function pageTs(page) {
  const scan = page.expand?.scan
  if (scan) {
    const raw = scan.completed_at ?? scan.started_at ?? scan.created
    if (raw) {
      const ms = Date.parse(String(raw))
      if (Number.isFinite(ms)) return ms
    }
  }
  if (page.created) {
    const ms = Date.parse(page.created)
    if (Number.isFinite(ms)) return ms
  }
  return 0
}

const pb = new PocketBase(PB_URL)
await pb.collection('users').authWithPassword(EMAIL, PASS)

const expandFieldTests = [
  { label: 'no fields', opts: { expand: 'scan' } },
  { label: 'expand scan fields', opts: { expand: 'scan', fields: 'id,url,title,scan,site,expand.scan.completed_at,expand.scan.started_at,expand.scan.created' } },
  { label: 'A11Y_PAGE_FIELDS', opts: { expand: 'scan', fields: 'id,url,title,scan,site,created' } }
]
for (const t of expandFieldTests) {
  const row = await pb.collection('pages').getList(1, 1, { filter: `site = "${SITE_ID}"`, ...t.opts })
  const p = row.items[0]
  console.log(t.label, {
    keys: Object.keys(p || {}),
    expandAt: p?.expand?.scan?.completed_at,
    ts: p ? pageTs(p) : null
  })
}

const pagesWithFields = await pb.collection('pages').getList(1, 1, {
  filter: `site = "${SITE_ID}"`,
  expand: 'scan',
  fields: 'id,url,title,scan,site,created'
})
const pagesNoFields = await pb.collection('pages').getList(1, 1, {
  filter: `site = "${SITE_ID}"`,
  expand: 'scan'
})
console.log('with fields keys:', Object.keys(pagesWithFields.items[0] || {}))
console.log('with fields created:', pagesWithFields.items[0]?.created)
console.log('with fields expand:', pagesWithFields.items[0]?.expand)
console.log('no fields created:', pagesNoFields.items[0]?.created)
console.log('no fields expand scan:', pagesNoFields.items[0]?.expand?.scan?.completed_at)

const pages = await pb.collection('pages').getFullList({
  filter: `site = "${SITE_ID}"`,
  expand: 'scan',
  fields: 'id,url,title,scan,site,created'
})

console.log('pages:', pages.length)
console.log('sample:', JSON.stringify(pages[0], null, 2))

const mapped = pages.map(p => ({ id: p.id, url: p.url, ts: pageTs(p) }))
console.log('mapped sample:', mapped[0])
console.log('ts stats:', {
  zero: mapped.filter(p => p.ts === 0).length,
  nan: mapped.filter(p => Number.isNaN(p.ts)).length,
  min: Math.min(...mapped.map(p => p.ts)),
  max: Math.max(...mapped.map(p => p.ts))
})

const ids = latestPageIdsByNormalizedUrl(mapped)
console.log('latest ids:', ids.size, [...ids].slice(0, 5))
