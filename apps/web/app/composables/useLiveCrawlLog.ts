import type { ActiveScanRow, Scan, ScanLogEvent } from '~/types/accessiq'
import { pbRelation } from '~/utils/pbFilter'
import {
  crawlLogLevelClass,
  eventToLine,
  formatLogLevelLabel,
  formatLogTimestamp,
  isTerminalScanLogStatus,
  LIVE_LOG_DISPLAY_MAX,
  mergeCrawlLogLines,
  pageToLine,
  queueStatusMessage,
  scanStatusToLine,
  trimLogLinesToRecent,
  type CrawlLogLine
} from '~/utils/crawlLog'
import {
  buildFullScanLogDownload,
  triggerScanLogDownload
} from '~/utils/scanLogExport'

export interface TerminalFooterLine {
  id: string
  ts: number
  level: CrawlLogLine['level']
  message: string
}

function terminalFooterFromScan(scan: Scan): TerminalFooterLine | null {
  const ts = Date.parse(String(scan.completed_at ?? scan.started_at ?? scan.created ?? ''))
  const time = Number.isFinite(ts) ? ts : Date.now()

  if (scan.status === 'complete' || scan.status === 'complete_with_errors') {
    const blocked = scan.unscanned_urls?.length ?? 0
    const suffix = blocked > 0 ? ` · ${blocked} page(s) could not be scanned` : ''
    return {
      id: `footer-complete-${scan.id}`,
      ts: time,
      level: scan.status === 'complete_with_errors' ? 'warn' : 'success',
      message: `── Scan complete · ${scan.pages_crawled ?? 0} page(s) saved${suffix} ──`
    }
  }
  if (scan.status === 'cancelled') {
    return {
      id: `footer-cancelled-${scan.id}`,
      ts: time,
      level: 'warn',
      message: '── Scan stopped ──'
    }
  }
  if (scan.status === 'failed') {
    return {
      id: `footer-failed-${scan.id}`,
      ts: time,
      level: 'error',
      message: scan.error_message
        ? `── Scan failed · ${scan.error_message} ──`
        : '── Scan failed ──'
    }
  }
  return null
}

function rowWatchKey(row: ActiveScanRow | null | undefined): string {
  if (!row) return ''
  if (row.source === 'queue') return `queue:${row.id}`
  return `scan:${row.recordId}`
}

export function useLiveCrawlLog(
  activeRow: Ref<ActiveScanRow | null | undefined>
) {
  const { pb } = usePocketBase()
  /** Full in-memory log for this scan until terminal (download uses PocketBase). */
  const allLines = ref<CrawlLogLine[]>([])
  const loading = ref(false)
  const lastScanSnapshot = ref<Scan | null>(null)
  const downloadLoading = ref(false)

  const scanId = computed(() =>
    activeRow.value?.source === 'scan' ? activeRow.value.recordId : null
  )

  const isLive = computed(() => {
    const row = activeRow.value
    if (!row) return false
    if (isTerminalScanLogStatus(row.status)) return false
    return ['pending', 'processing', 'running', 'background_scan', 'queued'].includes(row.status)
  })

  const isTerminal = computed(() => {
    const row = activeRow.value
    if (row?.source === 'scan' && isTerminalScanLogStatus(row.status)) return true
    const scan = lastScanSnapshot.value
    return scan ? isTerminalScanLogStatus(scan.status) : false
  })

  const isWaitingForScanner = computed(() => {
    const row = activeRow.value
    if (!row) return false
    if (row.source === 'queue' && ['pending', 'processing'].includes(row.status)) {
      return allLines.value.length <= 1
    }
    if (
      row.source === 'scan'
      && row.status === 'running'
      && !loading.value
    ) {
      const hasLogEvents = allLines.value.some(
        l => !l.id.startsWith('queue-') && !l.id.startsWith('footer-')
      )
      return !hasLogEvents
    }
    return false
  })

  const terminalFooter = computed((): TerminalFooterLine | null => {
    if (!isTerminal.value) return null
    const scan = lastScanSnapshot.value
    if (!scan) return null
    return terminalFooterFromScan(scan)
  })

  const displayLines = computed(() => {
    const footer = terminalFooter.value
    const visible = isTerminal.value
      ? allLines.value
      : trimLogLinesToRecent(allLines.value, LIVE_LOG_DISPLAY_MAX)

    if (!footer) return visible
    if (visible.some(l => l.id === footer.id)) return visible
    const footerLine: CrawlLogLine = {
      id: footer.id,
      ts: footer.ts,
      level: footer.level,
      message: footer.message
    }
    return [...visible, footerLine]
  })

  const totalLineCount = computed(() => allLines.value.length)

  const hiddenLineCount = computed(() => {
    if (isTerminal.value) return 0
    return Math.max(0, allLines.value.length - LIVE_LOG_DISPLAY_MAX)
  })

  let unsubscribeEvents: (() => void) | null = null
  let unsubscribePages: (() => void) | null = null
  let unsubscribeScan: (() => void) | null = null

  function setLines(next: CrawlLogLine[]) {
    allLines.value = next.slice().sort((a, b) => a.ts - b.ts)
  }

  function pushLine(line: CrawlLogLine) {
    if (allLines.value.some(l => l.id === line.id)) return
    allLines.value = [...allLines.value, line].sort((a, b) => a.ts - b.ts)
  }

  async function loadInitial() {
    const id = scanId.value
    if (!id || !pb) {
      setLines([])
      lastScanSnapshot.value = null
      return
    }

    loading.value = true
    try {
      const [events, pages, scan] = await Promise.all([
        pb.collection('scan_log_events').getFullList({
          filter: pbRelation('scan', id),
          sort: 'created'
        }).catch(() => []),
        pb.collection('pages').getFullList({
          filter: pbRelation('scan', id),
          sort: 'created'
        }).catch(() => []),
        pb.collection('scans').getOne(id).catch(() => null)
      ])

      const eventLines = (events as unknown as ScanLogEvent[]).map(eventToLine)
      const pageLines = (pages as Array<{ id: string, url: string, title?: string, created?: string }>)
        .map(p => pageToLine(p as import('~/types/accessiq').PageRecord))

      let merged = mergeCrawlLogLines(eventLines, pageLines, eventLines.length > 0)
      lastScanSnapshot.value = scan as Scan | null

      if (scan) {
        const startLine = scanStatusToLine(scan as Scan)
        if (startLine && !merged.some(l => l.id === startLine.id)) {
          merged = [startLine, ...merged].sort((a, b) => a.ts - b.ts)
        }
      }

      setLines(merged)
    } finally {
      loading.value = false
    }
  }

  function teardownSubscriptions() {
    if (unsubscribeEvents) {
      unsubscribeEvents()
      unsubscribeEvents = null
    }
    if (unsubscribePages) {
      unsubscribePages()
      unsubscribePages = null
    }
    if (unsubscribeScan) {
      unsubscribeScan()
      unsubscribeScan = null
    }
  }

  async function subscribe() {
    teardownSubscriptions()
    const id = scanId.value
    if (!id || !pb || !isLive.value) return

    try {
      unsubscribeEvents = await pb.collection('scan_log_events').subscribe('*', (e) => {
        const record = e.record as unknown as ScanLogEvent
        if (record.scan !== id) return
        pushLine(eventToLine(record))
      })
    } catch {
      // collection may not exist until migration
    }

    try {
      unsubscribePages = await pb.collection('pages').subscribe('*', (e) => {
        const record = e.record as { scan?: string, id: string, url: string, title?: string, created?: string }
        if (record.scan !== id) return
        if (allLines.value.some(l => l.url === record.url && l.level === 'success')) return
        pushLine(pageToLine(record as import('~/types/accessiq').PageRecord))
      })
    } catch {
      // optional
    }

    try {
      unsubscribeScan = await pb.collection('scans').subscribe(id, (e) => {
        const record = e.record as unknown as Scan
        const prev = lastScanSnapshot.value
        const statusLine = scanStatusToLine(record, prev ?? undefined)
        if (statusLine) pushLine(statusLine)
        lastScanSnapshot.value = record
        if (isTerminalScanLogStatus(record.status)) {
          teardownSubscriptions()
        }
      })
    } catch {
      // optional
    }
  }

  async function downloadFullLog() {
    const id = scanId.value
    if (!id || !pb) return
    downloadLoading.value = true
    try {
      const siteName = activeRow.value?.siteName
      const text = await buildFullScanLogDownload(pb, id, { siteName })
      triggerScanLogDownload(text, id)
    } finally {
      downloadLoading.value = false
    }
  }

  watch(
    () => rowWatchKey(activeRow.value),
    async (key, prevKey) => {
      if (key === prevKey) return
      teardownSubscriptions()

      if (!key) {
        setLines([])
        lastScanSnapshot.value = null
        return
      }

      const row = activeRow.value
      if (row?.source === 'queue') {
        setLines([{
          id: `queue-${row.id}`,
          ts: Date.now(),
          level: 'info',
          message: queueStatusMessage(row)
        }])
        lastScanSnapshot.value = null
        return
      }

      await loadInitial()
      if (isLive.value) await subscribe()
    },
    { immediate: true }
  )

  watch(isLive, async (live) => {
    if (live && scanId.value) {
      await subscribe()
    } else if (!live) {
      teardownSubscriptions()
    }
  })

  onUnmounted(() => {
    teardownSubscriptions()
  })

  return {
    lines: allLines,
    displayLines,
    totalLineCount,
    hiddenLineCount,
    loading,
    downloadLoading,
    isLive,
    isTerminal,
    isWaitingForScanner,
    terminalFooter,
    scanId,
    downloadFullLog,
    crawlLogLevelClass,
    formatLogTimestamp,
    formatLogLevelLabel
  }
}
