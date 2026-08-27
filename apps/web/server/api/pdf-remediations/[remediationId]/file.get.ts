import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, sendStream, setHeader } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'
import { pocketBaseFileUrl } from '../../../utils/pocketbaseFileUrl'

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const remediationId = getRouterParam(event, 'remediationId')?.trim()
  if (!remediationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing remediation id' })
  }

  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.authStore.save(token, null)

  let rem: Record<string, unknown>
  try {
    rem = await pb.collection('pdf_remediations').getOne(remediationId) as Record<string, unknown>
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Remediation not found' })
  }

  const file = String(rem.file ?? '')
  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'Suggested PDF not ready' })
  }

  const fileUrl = pocketBaseFileUrl(pb, rem, file)
  const response = await fetch(fileUrl, {
    headers: { Authorization: token }
  })
  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage: `Failed to fetch suggested PDF (${response.status})`
    })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="suggested-tagged.pdf"`)
  setHeader(event, 'Cache-Control', 'private, max-age=300')
  return sendStream(event, response.body)
})
