import type { Scan } from '~/types/sitenook'
import { compareTimestampsDesc } from '~/utils/sortTimestamps'
import { scanTimestamp, TERMINAL_SCAN_STATUSES } from '~/utils/scanDisplay'

export function isTerminalScanStatus(status: string): boolean {
  return TERMINAL_SCAN_STATUSES.includes(status as typeof TERMINAL_SCAN_STATUSES[number])
}

/** Latest finished scan by completed/started/created time (client-side sort). */
export function pickLatestTerminalScan(scans: Scan[]): Scan | null {
  const terminal = scans.filter(scan => isTerminalScanStatus(scan.status))
  if (!terminal.length) return null
  return terminal.slice().sort((a, b) =>
    compareTimestampsDesc(scanTimestamp(a), scanTimestamp(b))
  )[0] ?? null
}
