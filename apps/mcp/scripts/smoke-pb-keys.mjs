import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomBytes } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
    })
)

const pbUrl = 'http://127.0.0.1:8090'

async function main() {
  const auth = await fetch(`${pbUrl}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: env.PB_ADMIN_EMAIL, password: env.PB_ADMIN_PASSWORD })
  })
  if (!auth.ok) throw new Error(`admin auth ${auth.status}`)
  const { token } = await auth.json()

  const col = await fetch(`${pbUrl}/api/collections/api_keys`, {
    headers: { Authorization: token }
  })
  console.log('api_keys collection status', col.status)
  if (!col.ok) throw new Error('api_keys missing')

  const orgs = await fetch(`${pbUrl}/api/collections/organizations/records?perPage=1`, {
    headers: { Authorization: token }
  })
  const orgData = await orgs.json()
  const orgId = orgData.items?.[0]?.id
  if (!orgId) throw new Error('no org')

  const secret = randomBytes(24).toString('base64url')
  const plaintext = `ak_${secret}`
  const prefix = plaintext.slice(0, 11)
  const hash = createHash('sha256').update(plaintext, 'utf8').digest('hex')

  const created = await fetch(`${pbUrl}/api/collections/api_keys/records`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organization: orgId,
      name: 'pb-direct-smoke',
      key_prefix: prefix,
      key_hash: hash,
      scopes: ['read', 'write']
    })
  })
  const createdBody = await created.text()
  if (!created.ok) throw new Error(`create key ${created.status} ${createdBody}`)
  const record = JSON.parse(createdBody)
  console.log('created key id', record.id, 'prefix', prefix)

  const listed = await fetch(
    `${pbUrl}/api/collections/api_keys/records?filter=${encodeURIComponent(`key_prefix='${prefix}'`)}`,
    { headers: { Authorization: token } }
  )
  const listedData = await listed.json()
  const match = listedData.items?.find((row) => row.key_hash === hash && !row.revoked_at)
  if (!match) throw new Error('lookup by prefix/hash failed')
  console.log('lookup OK')

  await fetch(`${pbUrl}/api/collections/api_keys/records/${record.id}`, {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ revoked_at: new Date().toISOString() })
  })
  console.log('revoked OK')
  console.log('PB api_keys smoke passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
