#!/usr/bin/env node
/**
 * Rebuild the public help_articles Typesense collection.
 * Requires the web app to be running (uses POST /api/help/reindex).
 *
 * Usage: npm run reindex-help
 * Env: NUXT_PUBLIC_APP_URL (default http://localhost:3080)
 */
const base = (process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3080').replace(/\/$/, '')

async function main() {
  const url = `${base}/api/help/reindex`
  console.log(`Reindexing help articles via ${url} …`)
  const res = await fetch(url, { method: 'POST' })
  const text = await res.text()
  if (!res.ok) {
    console.error(`Failed (${res.status}): ${text}`)
    process.exit(1)
  }
  console.log(text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
