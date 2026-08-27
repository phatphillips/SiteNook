const metrics = {
  staleReadCount: 0,
  fallbackReadCount: 0,
  recomputeCount: 0,
  recomputeDurationMsTotal: 0
}

export function recordStaleRead(count = 1) {
  metrics.staleReadCount += Math.max(0, count)
}

export function recordFallbackRead(count = 1) {
  metrics.fallbackReadCount += Math.max(0, count)
}

export function recordRecompute(durationMs: number) {
  metrics.recomputeCount += 1
  if (Number.isFinite(durationMs) && durationMs > 0) {
    metrics.recomputeDurationMsTotal += durationMs
  }
}

export function getDashboardRollupTelemetry() {
  return {
    ...metrics,
    recomputeLatencyAvgMs: metrics.recomputeCount
      ? Math.round(metrics.recomputeDurationMsTotal / metrics.recomputeCount)
      : 0
  }
}
