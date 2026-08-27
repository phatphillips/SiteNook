import { createError } from 'h3'
import {
  getLicenceTierLimits,
  normalizeLicenceTier,
  organizationPlanForLicenceTier
} from '~/utils/licenceTiers'
import {
  buildLicenceTokenPayload,
  signLicenceToken,
  verifyLicenceToken
} from '../../utils/licenceTokens'

interface HeartbeatBody {
  signed_token?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<HeartbeatBody>(event)
  const token = String(body?.signed_token ?? '').trim()
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'signed_token is required' })
  }

  const payload = verifyLicenceToken(token, event)
  const pb = await getPbAdmin(event)

  let record
  try {
    record = await pb.collection('licences').getFirstListItem(
      `key = ${JSON.stringify(payload.key)}`
    )
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Licence not found' })
  }

  if (record.revoked) {
    throw createError({ statusCode: 401, statusMessage: 'Licence revoked' })
  }

  const expiresAt = String(record.expires_at ?? '')
  if (!expiresAt || Date.parse(expiresAt) < Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'Licence expired' })
  }

  const tier = normalizeLicenceTier(record.tier ?? payload.tier)
  const limits = getLicenceTierLimits(tier)
  const refreshed = buildLicenceTokenPayload({
    key: payload.key,
    tier,
    domain: payload.domain,
    fingerprint: payload.fingerprint,
    expires_at: expiresAt
  })

  return {
    valid: true,
    tier,
    plan: organizationPlanForLicenceTier(tier),
    limits: {
      maxSites: limits.maxSites,
      maxPagesPerScan: limits.maxPagesPerScan,
      maxTeamMembers: limits.maxTeamMembers,
      scanHistoryDays: limits.scanHistoryDays,
      scheduledScans: limits.scheduledScans,
      seoModule: limits.seoModule,
      policies: limits.policies,
      inventory: limits.inventory,
      pdfAccessibility: limits.pdfAccessibility
    },
    expires_at: expiresAt,
    signed_token: signLicenceToken(refreshed, event)
  }
})
