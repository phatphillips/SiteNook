import { createError, getRouterParam, sendStream, setHeader } from 'h3'
import { getPbAdmin } from '../../../utils/pbAdmin'
import { pocketBaseFileUrl } from '../../../utils/pocketbaseFileUrl'
import { isShareTokenValid } from '~/utils/reportSchedule'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')?.trim()
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share token' })
  }

  const escaped = token.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const pb = await getPbAdmin(event)

  let job: Record<string, unknown> | undefined
  try {
    const result = await pb.collection('report_jobs').getList(1, 1, {
      filter: `share_token = "${escaped}" && status = "complete"`
    })
    job = result.items[0] as unknown as Record<string, unknown> | undefined
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (!isShareTokenValid(String(job.share_token || ''), String(job.share_expires_at || ''), new Date())) {
    throw createError({ statusCode: 410, statusMessage: 'This report link has expired' })
  }

  const artifact = String(job.artifact || '')
  if (!artifact) {
    throw createError({ statusCode: 404, statusMessage: 'Artifact not available' })
  }

  const fileUrl = pocketBaseFileUrl(pb, job, artifact)
  const response = await fetch(fileUrl)
  if (!response.ok || !response.body) {
    throw createError({ statusCode: 502, statusMessage: 'Failed to load report artifact' })
  }

  setHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${String(job.artifact_name || artifact)}"`
  )
  setHeader(event, 'Cache-Control', 'private, no-store')
  return sendStream(event, response.body)
})
