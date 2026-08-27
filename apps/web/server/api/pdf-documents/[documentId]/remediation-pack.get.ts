import PocketBase from 'pocketbase'
import { createError, getHeader, getRouterParam, setHeader } from 'h3'
import { requirePbUser } from '../../../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../../../utils/resolvePbUrl'
import { pocketBaseFileUrl } from '../../../utils/pocketbaseFileUrl'
import { buildStoreZip } from '../../../utils/storeZip'

async function fetchPbFile(
  pb: PocketBase,
  record: Record<string, unknown>,
  filename: string,
  token: string
): Promise<Buffer | null> {
  if (!filename) return null
  const fileUrl = pocketBaseFileUrl(pb, record, filename)
  const response = await fetch(fileUrl, { headers: { Authorization: token } })
  if (!response.ok) return null
  return Buffer.from(await response.arrayBuffer())
}

export default defineEventHandler(async (event) => {
  await requirePbUser(event)

  const documentId = getRouterParam(event, 'documentId')?.trim()
  if (!documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing document id' })
  }

  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.authStore.save(token, null)

  let doc: Record<string, unknown>
  try {
    doc = await pb.collection('pdf_documents').getOne(documentId) as Record<string, unknown>
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'PDF document not found' })
  }

  const remediationId = String(doc.latest_remediation_id ?? '')
  let rem: Record<string, unknown> | null = null
  if (remediationId) {
    try {
      rem = await pb.collection('pdf_remediations').getOne(remediationId) as Record<string, unknown>
    } catch {
      rem = null
    }
  }

  const issues = await pb.collection('pdf_issues').getFullList({
    filter: `pdf_document = "${documentId}"`
  })

  const base = String(doc.filename || 'document').replace(/\.pdf$/i, '') || 'document'
  const files: Array<{ name: string, data: Buffer }> = []

  const original = await fetchPbFile(pb, doc, String(doc.file ?? ''), token)
  if (original) files.push({ name: `${base}-original.pdf`, data: original })

  if (rem?.file) {
    const suggested = await fetchPbFile(pb, rem, String(rem.file), token)
    if (suggested) files.push({ name: `${base}-suggested-tagged.pdf`, data: suggested })
  }

  for (const [field, outName] of [
    ['structure_json', `${base}-structure.json`],
    ['structure_html', `${base}-structure.html`],
    ['structure_markdown', `${base}-structure.md`]
  ] as const) {
    const buf = await fetchPbFile(pb, doc, String(doc[field] ?? ''), token)
    if (buf) files.push({ name: outName, data: buf })
  }

  const issueLines = [
    'rule_id,title,severity,category,page,description',
    ...issues.map((issue) => {
      const row = [
        issue.rule_id,
        issue.title,
        issue.severity,
        issue.category,
        issue.page_number ?? '',
        String(issue.description ?? '').replace(/"/g, '""')
      ]
      return row.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(',')
    })
  ]
  files.push({ name: `${base}-issues.csv`, data: Buffer.from(`${issueLines.join('\n')}\n`, 'utf8') })
  files.push({
    name: `${base}-summary.json`,
    data: Buffer.from(
      JSON.stringify(
        {
          documentId,
          filename: doc.filename,
          accessibilityScore: doc.accessibility_score,
          issueCount: doc.issue_count,
          structureStatus: doc.structure_status,
          remediationStatus: doc.remediation_status,
          remediation: rem
            ? {
                id: rem.id,
                beforeScore: rem.before_score,
                afterScore: rem.after_score,
                beforeIssueCount: rem.before_issue_count,
                afterIssueCount: rem.after_issue_count,
                issueDelta: rem.issue_delta,
                summary: rem.summary
              }
            : null,
          disclaimer:
            'Suggested Tagged PDF is remediation assist only. Tagged PDF is not certified PDF/UA.'
        },
        null,
        2
      ),
      'utf8'
    )
  })

  const bytes = buildStoreZip(files)
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${base}-remediation-pack.zip"`)
  return bytes
})
