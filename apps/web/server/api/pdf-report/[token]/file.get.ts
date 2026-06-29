import { createError, getRouterParam, sendStream, setHeader } from 'h3'
import { getPbAdmin } from '../../../utils/pbAdmin'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')?.trim()
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share token' })
  }

  const pb = await getPbAdmin()

  const result = await pb.collection('pdf_documents').getList(1, 1, {
    filter: `share_token = "${token.replace(/"/g, '\\"')}"`
  })
  const doc = result.items[0] as Record<string, unknown> | undefined
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  const file = String(doc.file ?? '')
  const url = String(doc.url ?? '')

  let response: Response
  if (file) {
    const fileUrl = pb.files.getUrl(doc, file)
    const adminToken = pb.authStore.token
    response = await fetch(fileUrl, {
      headers: adminToken ? { Authorization: adminToken } : {}
    })
  } else if (url) {
    response = await fetch(url, { redirect: 'follow' })
  } else {
    throw createError({ statusCode: 404, statusMessage: 'PDF has no file or URL' })
  }

  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status || 502,
      statusMessage: `Failed to fetch PDF (${response.status})`
    })
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Cache-Control', 'public, max-age=300')
  return sendStream(event, response.body)
})
