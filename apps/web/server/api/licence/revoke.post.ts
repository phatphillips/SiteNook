import { createError } from 'h3'
import { requireLicenceAdminKey } from '../../utils/licenceTokens'

interface RevokeBody {
  key?: string
}

export default defineEventHandler(async (event) => {
  requireLicenceAdminKey(event)

  const body = await readBody<RevokeBody>(event)
  const key = String(body?.key ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'key is required' })
  }

  const pb = await getPbAdmin(event)
  let record
  try {
    record = await pb.collection('licences').getFirstListItem(`key = ${JSON.stringify(key)}`)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Licence not found' })
  }

  await pb.collection('licences').update(record.id, { revoked: true })

  return { valid: true, key, revoked: true }
})
