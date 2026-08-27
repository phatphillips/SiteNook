import { createError, getHeader, getRouterParam, sendStream, setHeader } from 'h3'
import PocketBase from 'pocketbase'
import { requirePbUser } from '../../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../../utils/resolvePbUrl'
import { pocketBaseFileUrl } from '../../../../utils/pocketbaseFileUrl'
import { requireUserOrganizationId } from '~/utils/orgAccess'

export default defineEventHandler(async (event) => {
  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)
  const jobId = getRouterParam(event, 'jobId')?.trim()
  if (!jobId) throw createError({ statusCode: 400, statusMessage: 'Missing report job id' })

  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.authStore.save(token, null)
  const job = await pb.collection('report_jobs').getOne(jobId) as Record<string, unknown>
  if (String(job.org || '') !== orgId) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const artifact = String(job.artifact || '')
  if (!artifact) throw createError({ statusCode: 404, statusMessage: 'Artifact not available yet' })

  const response = await fetch(pocketBaseFileUrl(pb, job, artifact), { headers: { Authorization: token } })
  if (!response.ok || !response.body) throw createError({ statusCode: 502, statusMessage: 'Failed to load report artifact' })

  setHeader(event, 'Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  setHeader(event, 'Content-Disposition', `attachment; filename="${String(job.artifact_name || artifact)}"`)
  return sendStream(event, response.body)
})
