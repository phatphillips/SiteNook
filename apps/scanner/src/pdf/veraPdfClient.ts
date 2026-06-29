const DEFAULT_PROFILE = 'ua1'

export interface VeraPdfCheck {
  status?: string
  location?: string
  context?: string
  errorMessage?: string
}

export interface VeraPdfValidationResult {
  statement?: string
  checks?: VeraPdfCheck[]
  failedChecks?: number
  clause?: string
  testNumber?: number
  tags?: string[]
}

export interface VeraPdfValidationResponse {
  compliant?: boolean
  profileName?: string
  validationResult?: VeraPdfValidationResult[]
}

interface VeraRuleSummary {
  ruleStatus?: string
  status?: string
  description?: string
  failedChecks?: number
  clause?: string
  testNumber?: number
  tags?: string[]
  checks?: Array<{ status?: string, context?: string, errorArguments?: string[] }>
}

/** veraPDF REST wraps results under report.jobs[].validationResult[].details.ruleSummaries */
export function normalizeVeraPdfResponse(raw: unknown): VeraPdfValidationResponse {
  if (!raw || typeof raw !== 'object') {
    return { compliant: false, validationResult: [] }
  }

  const root = raw as Record<string, unknown>

  if (Array.isArray(root.validationResult) && !('report' in root)) {
    return root as VeraPdfValidationResponse
  }

  const reportWrapper = root.report as { jobs?: Array<{ validationResult?: unknown[] }> } | undefined
  const firstResult = reportWrapper?.jobs?.[0]?.validationResult?.[0] as Record<string, unknown> | undefined
  if (!firstResult) {
    return { compliant: false, validationResult: [] }
  }

  const details = firstResult.details as { ruleSummaries?: VeraRuleSummary[] } | undefined
  const ruleSummaries = details?.ruleSummaries ?? []

  const validationResult: VeraPdfValidationResult[] = ruleSummaries
    .filter(rule => rule.status === 'failed' || rule.ruleStatus === 'FAILED')
    .map(rule => ({
      statement: rule.description ?? '',
      failedChecks: rule.failedChecks,
      clause: rule.clause,
      testNumber: rule.testNumber,
      tags: rule.tags,
      checks: (rule.checks ?? [])
        .filter(check => check.status === 'failed')
        .map(check => ({
          status: 'failed',
          context: check.context,
          location: check.context,
          errorMessage: check.context
        }))
    }))

  return {
    compliant: firstResult.compliant === true,
    profileName: String(firstResult.profileName ?? ''),
    validationResult
  }
}

export async function validatePdfBuffer(
  buffer: Buffer,
  filename = 'document.pdf'
): Promise<VeraPdfValidationResponse> {
  const form = new FormData()
  const blob = new Blob([buffer], { type: 'application/pdf' })
  form.append('file', blob, filename)

  const baseUrl = process.env.VERAPDF_URL || 'http://verapdf:8080'
  const response = await fetch(`${baseUrl}/api/validate/${DEFAULT_PROFILE}`, {
    method: 'POST',
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`veraPDF validation failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const raw = await response.json()
  return normalizeVeraPdfResponse(raw)
}

export async function validatePdfUrl(
  url: string,
  fileSizeBytes?: number
): Promise<VeraPdfValidationResponse> {
  const baseUrl = process.env.VERAPDF_URL || 'http://verapdf:8080'
  const form = new FormData()
  form.append('url', url)
  if (fileSizeBytes != null) {
    form.append('fileSize', String(fileSizeBytes))
  }

  const response = await fetch(`${baseUrl}/api/validate/url/${DEFAULT_PROFILE}`, {
    method: 'POST',
    body: form
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`veraPDF URL validation failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const raw = await response.json()
  return normalizeVeraPdfResponse(raw)
}
