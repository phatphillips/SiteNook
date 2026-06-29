import { createError } from 'h3'
import {
  buildLicenceTokenPayload,
  hashInstanceFingerprint,
  signLicenceToken
} from '../../utils/licenceTokens'

interface ValidateBody {
  key?: string
  domain?: string
  instance_fingerprint?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ValidateBody>(event)
  const key = String(body?.key ?? '').trim()
  const domain = String(body?.domain ?? '').trim().toLowerCase()
  const fingerprintRaw = String(body?.instance_fingerprint ?? '').trim()

  if (!key || !domain || !fingerprintRaw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'key, domain, and instance_fingerprint are required'
    })
  }

  const pb = await getPbAdmin(event)
  let record
  try {
    record = await pb.collection('licences').getFirstListItem(`key = ${JSON.stringify(key)}`)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid licence key' })
  }

  if (record.revoked) {
    throw createError({ statusCode: 401, statusMessage: 'Licence revoked' })
  }

  const expiresAt = String(record.expires_at ?? '')
  if (!expiresAt || Date.parse(expiresAt) < Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'Licence expired' })
  }

  const boundDomain = String(record.domain ?? '').trim().toLowerCase()
  if (boundDomain && boundDomain !== domain) {
    throw createError({ statusCode: 401, statusMessage: 'Licence domain mismatch' })
  }

  const fingerprint = hashInstanceFingerprint(domain, fingerprintRaw)
  const storedFingerprint = String(record.fingerprint ?? '').trim()
  if (storedFingerprint && storedFingerprint !== fingerprint) {
    throw createError({ statusCode: 401, statusMessage: 'Licence instance mismatch' })
  }

  if (!storedFingerprint) {
    await pb.collection('licences').update(record.id, { fingerprint })
  }

  const tier = String(record.tier ?? 'enterprise')
  const payload = buildLicenceTokenPayload({
    key,
    tier,
    domain,
    fingerprint,
    expires_at: expiresAt
  })

  return {
    valid: true,
    tier,
    expires_at: expiresAt,
    signed_token: signLicenceToken(payload, event)
  }
})
