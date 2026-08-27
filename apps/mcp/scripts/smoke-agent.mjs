/**
 * Smoke-test agent API against local Docker (loads repo .env, never prints secrets).
 * Usage: node apps/mcp/scripts/smoke-agent.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const envPath = resolve(root, '.env')

function loadEnv(path) {
  const out = {}
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    console.error('Missing .env at repo root')
    process.exit(1)
  }
  return out
}

const env = loadEnv(envPath)
const baseUrl = process.env.SITENOOK_URL || 'http://localhost:3500'
const pbUrl = process.env.PB_URL || 'http://localhost:8090'
const email = env.APP_USER_EMAIL
const password = env.APP_USER_PASSWORD

if (!email || !password) {
  console.error('APP_USER_EMAIL / APP_USER_PASSWORD required in .env')
  process.exit(1)
}

async function main() {
  console.log('Auth with PocketBase…')
  const authRes = await fetch(`${pbUrl}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password })
  })
  const authText = await authRes.text()
  if (!authRes.ok) {
    console.error('PB auth failed', authRes.status)
    process.exit(1)
  }
  const auth = JSON.parse(authText)
  const token = auth.token
  console.log('OK user JWT')

  console.log('Create API key…')
  const createRes = await fetch(`${baseUrl}/api/agent/keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'smoke-mcp', scopes: ['read', 'write'] })
  })
  const createText = await createRes.text()
  if (!createRes.ok) {
    console.error('Create key failed', createRes.status, createText.slice(0, 500))
    process.exit(1)
  }
  const created = JSON.parse(createText)
  const apiKey = created.key
  if (!apiKey?.startsWith('ak_')) {
    console.error('Unexpected key payload')
    process.exit(1)
  }
  console.log('OK key created (prefix', created.item?.key_prefix + ')')

  console.log('List sites with API key…')
  const sitesRes = await fetch(`${baseUrl}/api/agent/sites`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  const sitesText = await sitesRes.text()
  if (!sitesRes.ok) {
    console.error('List sites failed', sitesRes.status, sitesText.slice(0, 500))
    process.exit(1)
  }
  const sites = JSON.parse(sitesText)
  console.log('OK sites count:', Array.isArray(sites.items) ? sites.items.length : '?')

  if (sites.items?.[0]?.id) {
    const siteId = sites.items[0].id
    console.log('Get scan status for first site…')
    const statusRes = await fetch(`${baseUrl}/api/agent/sites/${siteId}/scans`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    const statusText = await statusRes.text()
    if (!statusRes.ok) {
      console.error('Scan status failed', statusRes.status, statusText.slice(0, 500))
      process.exit(1)
    }
    console.log('OK scan status')
  }

  console.log('Revoke smoke key…')
  const revokeRes = await fetch(`${baseUrl}/api/agent/keys/${created.item.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!revokeRes.ok) {
    console.error('Revoke failed', revokeRes.status)
    process.exit(1)
  }
  console.log('OK revoked')
  console.log('Smoke test passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
