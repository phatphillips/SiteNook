import PocketBase from 'pocketbase'

const pb = new PocketBase(process.env.NUXT_POCKETBASE_URL || 'http://localhost:8090')
await pb.collection('_superusers').authWithPassword(
  process.env.NUXT_PB_ADMIN_EMAIL,
  process.env.NUXT_PB_ADMIN_PASSWORD
)

const orgId = 'i4kl63q5xav5wm8'
const sites = await pb.collection('sites').getFullList({
  filter: `organization = "${orgId}"`,
  fields: 'id,name',
  sort: 'name'
})

function pickDisplayScan(scans) {
  const sorted = scans.slice().sort((a, b) => {
    const aRunning = a.status === 'running' ? 1 : 0
    const bRunning = b.status === 'running' ? 1 : 0
    if (aRunning !== bRunning) return bRunning - aRunning
    const aTs = a.completed_at || a.started_at || a.created || ''
    const bTs = b.completed_at || b.started_at || b.created || ''
    return bTs.localeCompare(aTs)
  })
  return sorted[0] ?? null
}

for (const site of sites) {
  const scans = await pb.collection('scans').getFullList({
    filter: `site = "${site.id}" && (status = 'complete' || status = 'complete_with_errors' || status = 'running')`,
    fields: 'id,status,completed_at,started_at',
    sort: '-completed_at,-started_at'
  })
  const display = pickDisplayScan(scans)
  let inv = 0
  let pages = 0
  if (display?.id) {
    inv = (await pb.collection('qa_inventory').getList(1, 1, { filter: `scan = "${display.id}"` })).totalItems
    pages = (await pb.collection('pages').getList(1, 1, { filter: `scan = "${display.id}"` })).totalItems
  }
  console.log(`${site.name}: display=${display?.status}:${display?.id} pages=${pages} inventory=${inv}`)
}
