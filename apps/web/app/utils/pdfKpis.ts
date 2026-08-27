import type { PdfDocument, PdfRemediation } from '~/types/sitenook'

export interface PdfLibraryKpis {
  discovered: number
  validated: number
  structured: number
  remediated: number
  needsHumanFinish: number
  medianIssueDelta: number | null
  averageLiftPercent: number | null
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

export function computePdfLibraryKpis(
  documents: PdfDocument[],
  remediations: PdfRemediation[] = []
): PdfLibraryKpis {
  const byId = new Map(remediations.map(r => [r.id, r]))
  const remediationsByDoc = new Map<string, PdfRemediation>()
  for (const rem of remediations) {
    if (rem.status !== 'complete') continue
    const existing = remediationsByDoc.get(rem.pdf_document)
    if (!existing || (rem.created || '') > (existing.created || '')) {
      remediationsByDoc.set(rem.pdf_document, rem)
    }
  }

  let validated = 0
  let structured = 0
  let remediated = 0
  let needsHumanFinish = 0
  const deltas: number[] = []
  const lifts: number[] = []

  for (const doc of documents) {
    if (doc.status === 'complete') validated += 1
    if (doc.structure_status === 'complete') structured += 1

    const rem =
      (doc.latest_remediation_id && byId.get(doc.latest_remediation_id)) ||
      remediationsByDoc.get(doc.id)

    if (doc.remediation_status === 'complete' || rem?.status === 'complete') {
      remediated += 1
      const after = rem?.after_issue_count ?? 0
      if (after > 0) needsHumanFinish += 1
      if (typeof rem?.issue_delta === 'number') deltas.push(rem.issue_delta)
      const lift = rem?.summary?.liftPercent
      if (typeof lift === 'number') lifts.push(lift)
      else if (rem && (rem.before_issue_count ?? 0) > 0) {
        lifts.push(
          Math.round(((rem.before_issue_count! - (rem.after_issue_count ?? 0)) / rem.before_issue_count!) * 1000) / 10
        )
      }
    }
  }

  return {
    discovered: documents.length,
    validated,
    structured,
    remediated,
    needsHumanFinish,
    medianIssueDelta: median(deltas),
    averageLiftPercent: lifts.length
      ? Math.round((lifts.reduce((a, b) => a + b, 0) / lifts.length) * 10) / 10
      : null
  }
}
