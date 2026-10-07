import type { ReportStatus } from '~/types/reports'

export interface ReportProgressStage {
  id: string
  label: string
  minProgress: number
}

export const REPORT_PROGRESS_STAGES: ReportProgressStage[] = [
  { id: 'queued', label: 'Queued', minProgress: 0 },
  { id: 'preparing', label: 'Preparing data', minProgress: 5 },
  { id: 'rendering', label: 'Rendering sections', minProgress: 20 },
  { id: 'pdf', label: 'Building PDF', minProgress: 85 },
  { id: 'complete', label: 'Ready to download', minProgress: 100 }
]

export function clampReportProgress(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function activeReportProgressStage(progress: number): ReportProgressStage {
  const safe = clampReportProgress(progress)
  let current = REPORT_PROGRESS_STAGES[0]!
  for (const stage of REPORT_PROGRESS_STAGES) {
    if (safe >= stage.minProgress) current = stage
  }
  return current
}

export function isReportJobActive(status: ReportStatus | undefined): boolean {
  return status === 'pending' || status === 'processing'
}

export function reportStatusHeadline(
  status: ReportStatus | undefined,
  progressLabel?: string
): string {
  if (progressLabel?.trim()) return progressLabel.trim()
  if (status === 'pending') return 'Queued. Waiting for the scanner'
  if (status === 'processing') return 'Generating your report'
  if (status === 'complete') return 'Report ready'
  if (status === 'failed') return 'Report generation failed'
  if (status === 'cancelled') return 'Report cancelled'
  return 'Preparing report'
}
