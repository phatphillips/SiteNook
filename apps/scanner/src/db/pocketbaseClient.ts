import PocketBase from 'pocketbase'

let client: PocketBase | null = null

export function getPocketBase(): PocketBase {
  if (!client) {
    const url = process.env.POCKETBASE_URL || 'http://localhost:8090'
    client = new PocketBase(url)
    client.autoCancellation(false)
  }
  return client
}

export async function authenticateAdmin(maxAttempts = 30, delayMs = 2000): Promise<PocketBase> {
  const pb = getPocketBase()
  const email = process.env.POCKETBASE_ADMIN_EMAIL
  const password = process.env.POCKETBASE_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD are required')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pb.collection('_superusers').authWithPassword(email, password)
      return pb
    } catch {
      try {
        await pb.admins.authWithPassword(email, password)
        return pb
      } catch (err) {
        if (attempt === maxAttempts) throw err
        console.log(`Waiting for PocketBase (attempt ${attempt}/${maxAttempts})...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  return pb
}

export async function batchCreate<T extends Record<string, unknown>>(
  collection: string,
  records: T[],
  batchSize = 50
): Promise<void> {
  const pb = getPocketBase()
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    await Promise.all(batch.map(record => pb.collection(collection).create(record)))
  }
}
