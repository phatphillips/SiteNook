#!/usr/bin/env node
/**
 * Demo environment helper for screenshot / local showcase setups.
 *
 * 1) Creates five public example sites (idempotent by URL)
 * 2) Queues a capped full scan for each site
 * 3) After scans finish (or with --history-only), inserts prior completed scans
 *    so overview trend charts have meaningful history
 *
 * Usage (PocketBase must be reachable, typically http://localhost:8090):
 *
 *   node scripts/seed-demo-environment.mjs
 *   node scripts/seed-demo-environment.mjs --history-only
 *   node scripts/seed-demo-environment.mjs --wait
 *
 * Env (loaded from repo .env when present):
 *   PB_URL / POCKETBASE_URL (default http://localhost:8090)
 *   PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD
 *   APP_USER_EMAIL (owner for sites; falls back to first org admin)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(root, '.env'))

const PB_URL = (process.env.PB_URL || process.env.POCKETBASE_URL || 'http://localhost:8090').replace(/\/$/, '')
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const APP_USER_EMAIL = process.env.APP_USER_EMAIL

const args = new Set(process.argv.slice(2))
const HISTORY_ONLY = args.has('--history-only')
const WAIT = args.has('--wait')
const MAX_PAGES = Number(process.env.DEMO_MAX_PAGES || 20)

/** Credible public sites with a mix of quality for a11y / SEO / QA demos. */
const DEMO_SITES = [
  {
    name: 'WebAIM',
    url: 'https://webaim.org',
    description: 'Web accessibility training and resources'
  },
  {
    name: 'The A11Y Project',
    url: 'https://www.a11yproject.com',
    description: 'Community-driven accessibility patterns and checklist'
  },
  {
    name: 'Inclusive Components',
    url: 'https://inclusive-components.design',
    description: 'Heydon Pickering inclusive component patterns'
  },
  {
    name: 'GOV.UK Design System',
    url: 'https://design-system.service.gov.uk',
    description: 'UK government design system and components'
  },
  {
    name: 'NHS service manual',
    url: 'https://service-manual.nhs.uk',
    description: 'NHS digital service manual and accessibility guidance'
  }
]

function daysAgoIso(days, hour = 10) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

/**
 * Build prior scans that slowly improve into the latest real scan:
 * scores rise gently; open issues + broken links fall gradually (active remediation story).
 */
function historyPoints(seed, latest) {
  const days = [28, 21, 14, 7, 3]
  const endIssues = Math.max(8, Number(latest?.open_issue_count) || 80)
  const endBroken = Math.max(0, Number(latest?.broken_link_count) || 3)
  const endOverall = clamp(Number(latest?.score_overall) || 82, 50, 99)
  const endQa = clamp(Number(latest?.score_qa) || endOverall - 4, 45, 99)
  const endSeo = clamp(Number(latest?.score_seo) || endOverall - 6, 40, 99)
  const endPages = Math.max(8, Number(latest?.pages_crawled) || 16)

  // Oldest point: clearly worse, then ease toward just above today's real scan.
  const startIssues = Math.round(endIssues * (1.55 + (seed % 4) * 0.04))
  const nearIssues = Math.round(endIssues * 1.06)
  const startBroken = Math.max(endBroken + 8, Math.round(endBroken * 2.4) + 5)
  const nearBroken = Math.max(endBroken + 1, Math.round(endBroken * 1.12))
  const startOverall = clamp(endOverall - (13 + (seed % 4)), 42, 96)
  const nearOverall = clamp(endOverall - 1, startOverall + 1, 99)
  const startQa = clamp(endQa - (12 + (seed % 3)), 40, 96)
  const nearQa = clamp(endQa - 1, startQa + 1, 99)
  const startSeo = clamp(endSeo - (14 + ((seed + 1) % 4)), 38, 96)
  const nearSeo = clamp(endSeo - 1, startSeo + 1, 99)

  return days.map((daysAgo, i) => {
    const t = i / (days.length - 1)
    // Ease-out: remediation progresses steadily, slightly faster later.
    const ease = 1 - (1 - t) ** 1.35
    const overall = clamp(Math.round(startOverall + (nearOverall - startOverall) * ease), 40, 99)
    const qa = clamp(Math.round(startQa + (nearQa - startQa) * ease), 38, 99)
    const seo = clamp(Math.round(startSeo + (nearSeo - startSeo) * ease), 36, 99)
    const openIssues = Math.max(endIssues, Math.round(startIssues + (nearIssues - startIssues) * ease))
    const broken = Math.max(endBroken, Math.round(startBroken + (nearBroken - startBroken) * ease))
    return {
      daysAgo,
      score_overall: overall,
      score_a: clamp(overall + 2, 0, 100),
      score_aa: overall,
      score_aaa: clamp(overall - 8, 0, 100),
      score_qa: qa,
      score_seo: seo,
      score_seo_technical: clamp(seo + 2, 0, 100),
      score_seo_content: clamp(seo - 3, 0, 100),
      open_issue_count: openIssues,
      pages_crawled: Math.max(6, endPages - (days.length - 1 - i) * 2 + (seed % 3)),
      broken_link_count: broken
    }
  })
}

async function pb(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data?.message || data?.raw || res.statusText
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`)
  }
  return data
}

async function authAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required')
  }
  const body = { identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  try {
    const data = await pb('/api/collections/_superusers/auth-with-password', {
      method: 'POST',
      body
    })
    return data.token
  } catch {
    const data = await pb('/api/admins/auth-with-password', {
      method: 'POST',
      body
    })
    return data.token
  }
}

function defaultScanConfig(siteUrl) {
  let sitemapUrl = ''
  try {
    sitemapUrl = `${new URL(siteUrl).origin}/sitemap.xml`
  } catch {
    sitemapUrl = ''
  }
  return {
    mode: 'full',
    pages: [],
    sitemapUrl,
    maxPages: MAX_PAGES,
    maxDepth: 3,
    stayOnDomain: true,
    respectRobots: true,
    includePatterns: [],
    excludePatterns: ['/logout', '/wp-admin/*', '/cdn-cgi/*'],
    viewport: 'desktop',
    waitStrategy: 'load',
    concurrency: 2,
    timeout: 30,
    auth: { type: 'none' },
    scheduleEnabled: false,
    scheduleFrequency: 'daily',
    scheduleTime: '02:00',
    customHeaders: {},
    userAgent: null
  }
}

function defaultSiteSettings() {
  return {
    checkAccessibility: true,
    checkQa: true,
    checkSeo: true,
    checkSpelling: true,
    checkBrokenLinks: true,
    checkInventory: true,
    checkReadability: true,
    checkPolicies: true
  }
}

async function listAll(token, collection, filter) {
  const items = []
  let page = 1
  for (;;) {
    const q = new URLSearchParams({
      page: String(page),
      perPage: '100',
      ...(filter ? { filter } : {})
    })
    const data = await pb(`/api/collections/${collection}/records?${q}`, { token })
    items.push(...(data.items || []))
    if (!data.items?.length || items.length >= (data.totalItems || 0)) break
    page += 1
  }
  return items
}

async function resolveOwner(token) {
  const orgs = await listAll(token, 'organizations')
  const org = orgs[0]
  if (!org) throw new Error('No organization found. Start the stack so seed.sh can create one.')

  let user = null
  if (APP_USER_EMAIL) {
    const users = await listAll(token, 'users', `email="${APP_USER_EMAIL}"`)
    user = users[0] || null
  }
  if (!user) {
    const users = await listAll(token, 'users', `organization="${org.id}"`)
    user = users.find(u => u.role === 'admin') || users[0]
  }
  if (!user) throw new Error('No app user found to own demo sites')
  return { org, user }
}

async function ensureSite(token, org, user, siteDef) {
  const existing = await listAll(token, 'sites', `url="${siteDef.url}" && organization="${org.id}"`)
  if (existing[0]) {
    console.log(`Site exists: ${siteDef.name} (${existing[0].id})`)
    return existing[0]
  }

  const record = await pb('/api/collections/sites/records', {
    method: 'POST',
    token,
    body: {
      name: siteDef.name,
      url: siteDef.url,
      description: siteDef.description,
      organization: org.id,
      owner: user.id,
      crawl_schedule: 'manual',
      default_scan_config: defaultScanConfig(siteDef.url),
      site_settings: defaultSiteSettings(),
      schedule_next_run_at: null,
      schedule_last_enqueued_at: null
    }
  })

  try {
    await pb('/api/collections/site_access/records', {
      method: 'POST',
      token,
      body: { user: user.id, site: record.id, role: 'owner' }
    })
  } catch {
    // ignore duplicate access
  }

  console.log(`Created site: ${siteDef.name} (${record.id})`)
  return record
}

async function queueScan(token, site, user) {
  const pending = await listAll(
    token,
    'scan_queue',
    `site="${site.id}" && (status="pending" || status="processing")`
  )
  if (pending.length) {
    console.log(`Scan already queued for ${site.name}`)
    return pending[0]
  }

  const row = await pb('/api/collections/scan_queue/records', {
    method: 'POST',
    token,
    body: {
      site: site.id,
      scan_type: 'full',
      priority: 50,
      requested_by: user.id,
      status: 'pending',
      raw_config: defaultScanConfig(site.url)
    }
  })
  console.log(`Queued scan for ${site.name}`)
  return row
}

async function waitForScans(token, siteIds, timeoutMs = 45 * 60 * 1000) {
  const start = Date.now()
  console.log(`Waiting for scans on ${siteIds.length} site(s)...`)
  while (Date.now() - start < timeoutMs) {
    let remaining = 0
    for (const siteId of siteIds) {
      const active = await listAll(
        token,
        'scan_queue',
        `site="${siteId}" && (status="pending" || status="processing")`
      )
      remaining += active.length
    }
    if (remaining === 0) {
      console.log('All queued scans finished.')
      return
    }
    console.log(`  ${remaining} scan(s) still active...`)
    await new Promise(r => setTimeout(r, 15000))
  }
  throw new Error('Timed out waiting for scans')
}

async function seedHistory(token, site, seed) {
  const existing = await listAll(token, 'scans', `site="${site.id}"`)
  const realScans = existing.filter(s => !s.diff_summary?.demoHistory)
  const latestReal = realScans
    .filter(s => s.status === 'complete' || s.status === 'complete_with_errors')
    .slice()
    .sort((a, b) => String(b.completed_at || b.created).localeCompare(String(a.completed_at || a.created)))[0]

  const tagged = existing.filter(s => s.diff_summary?.demoHistory === true)

  // Always refresh demo-history rows so trends stay anchored to the latest real scan.
  for (const row of tagged) {
    await pb(`/api/collections/scans/records/${row.id}`, { method: 'DELETE', token })
  }

  const points = historyPoints(seed, latestReal)
  let created = 0
  for (const point of points) {
    const completedAt = daysAgoIso(point.daysAgo, 9 + (seed % 5))
    const startedAt = daysAgoIso(point.daysAgo, 8 + (seed % 5))
    // Skip if a real scan already exists on the same calendar day
    const day = completedAt.slice(0, 10)
    const clash = realScans.some((s) => String(s.completed_at || '').startsWith(day))
    if (clash) continue

    await pb('/api/collections/scans/records', {
      method: 'POST',
      token,
      body: {
        site: site.id,
        status: 'complete',
        scan_type: 'full',
        pages_crawled: point.pages_crawled,
        started_at: startedAt,
        completed_at: completedAt,
        wcag_version: '2.2',
        score_a: point.score_a,
        score_aa: point.score_aa,
        score_aaa: point.score_aaa,
        score_overall: point.score_overall,
        score_qa: point.score_qa,
        score_seo: point.score_seo,
        score_seo_technical: point.score_seo_technical,
        score_seo_content: point.score_seo_content,
        open_issue_count: point.open_issue_count,
        broken_link_count: point.broken_link_count,
        raw_config: defaultScanConfig(site.url),
        diff_summary: {
          demoHistory: true,
          note: 'Synthetic prior scan for demo trends'
        }
      }
    })
    created += 1
  }

  if (latestReal) {
    console.log(
      `Seeded ${created} history row(s) for ${site.name} `
      + `(issues ${points[0]?.open_issue_count}→${latestReal.open_issue_count}, `
      + `broken ${points[0]?.broken_link_count}→${latestReal.broken_link_count ?? 0})`
    )
  } else {
    console.log(`Seeded ${created} history row(s) for ${site.name} (no completed real scan yet)`)
  }
}

async function main() {
  console.log(`PocketBase: ${PB_URL}`)
  const token = await authAdmin()
  const { org, user } = await resolveOwner(token)
  console.log(`Org: ${org.name} (${org.id})`)
  console.log(`Owner: ${user.email} (${user.id})`)

  const sites = []
  for (const def of DEMO_SITES) {
    sites.push(await ensureSite(token, org, user, def))
  }

  if (!HISTORY_ONLY) {
    for (const site of sites) {
      await queueScan(token, site, user)
    }
    if (WAIT) {
      await waitForScans(token, sites.map(s => s.id))
    } else {
      console.log('Scans queued. Re-run with --wait to block until done, then --history-only if needed.')
    }
  }

  // Always seed history (safe / idempotent for demo-tagged rows)
  for (let i = 0; i < sites.length; i++) {
    await seedHistory(token, sites[i], i + 3)
  }

  console.log('\nDone. Demo sites:')
  for (const site of sites) {
    console.log(`  - ${site.name}: ${site.url}`)
  }
  if (!HISTORY_ONLY && !WAIT) {
    console.log('\nTip: after scans complete, run:')
    console.log('  node scripts/seed-demo-environment.mjs --history-only')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
