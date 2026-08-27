import { createError } from 'h3'
import { getPbAdmin } from '../../utils/pbAdmin'
import { pocketBaseFileUrl } from '../../utils/pocketbaseFileUrl'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')?.trim()
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share token' })
  }

  const pb = await getPbAdmin()

  let document
  try {
    const result = await pb.collection('pdf_documents').getList(1, 1, {
      filter: `share_token = "${token.replace(/"/g, '\\"')}"`
    })
    document = result.items[0]
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Report not found' })
  }

  const issues = await pb.collection('pdf_issues').getFullList({
    filter: `pdf_document = "${document.id}"`,
    sort: 'category,severity'
  })

  let fileUrl: string | null = null
  const file = String((document as { file?: string }).file ?? '')
  const url = String((document as { url?: string }).url ?? '')
  if (file) {
    fileUrl = pocketBaseFileUrl(pb, document, file)
  } else if (url) {
    fileUrl = url
  }

  return {
    document,
    issues,
    fileUrl
  }
})
