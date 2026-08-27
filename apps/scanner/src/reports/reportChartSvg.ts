export interface ChartBarItem {
  label: string
  value: number | null
  max?: number
  color?: string
}

export interface ChartTrendPoint {
  label: string
  value: number | null
}

export type MetricTone = 'good' | 'warn' | 'bad' | 'neutral' | 'critical' | 'serious' | 'moderate' | 'minor'

export function scoreRingColor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

export function formatScoreLabel(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—'
  const rounded = Math.round(score * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function escapeSvg(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDegrees: number) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  }
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

/** Score donut: score centered in ring, label below the SVG (avoids overlap). */
export function renderScoreDonutSvg(
  score: number | null,
  label: string,
  options: { size?: number } = {}
): string {
  const size = options.size ?? 168
  const center = size / 2
  const radius = size * 0.36
  const stroke = size * 0.085
  const scoreText = formatScoreLabel(score)
  const color = score == null ? '#d4d4d8' : scoreRingColor(score)
  const safeScore = score == null || !Number.isFinite(score) ? 0 : Math.max(0, Math.min(100, score))
  const arcPath = safeScore > 0
    ? describeArc(center, center, radius, 0, Math.max(1.5, (safeScore / 100) * 360))
    : ''

  return `
    <div class="donut-block">
      <svg class="chart-svg donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeSvg(label)} ${scoreText}">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e4e4e7" stroke-width="${stroke}" />
        ${arcPath ? `<path d="${arcPath}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" />` : ''}
        <text x="${center}" y="${center + size * 0.04}" text-anchor="middle" font-size="${size * 0.22}" font-weight="700" fill="#18181b">${escapeSvg(scoreText)}</text>
      </svg>
      <p class="donut-label">${escapeSvg(label)}</p>
    </div>
  `
}

export function renderHorizontalBarChart(items: ChartBarItem[]): string {
  if (!items.length) {
    return '<p class="section-meta">No score data available.</p>'
  }

  const rowHeight = 34
  const labelWidth = 78
  const valueWidth = 44
  const chartWidth = 280
  const width = labelWidth + chartWidth + valueWidth
  const height = items.length * rowHeight + 4

  const rows = items.map((item, index) => {
    const y = 4 + index * rowHeight + rowHeight / 2
    const max = item.max ?? 100
    const numericValue = item.value == null || !Number.isFinite(item.value) ? null : item.value
    const fillWidth = numericValue == null || max <= 0
      ? 0
      : Math.max(0, Math.min(chartWidth, (numericValue / max) * chartWidth))
    const color = numericValue == null ? '#d4d4d8' : (item.color ?? scoreRingColor(numericValue))
    const trackX = labelWidth
    const trackY = y - 5

    return `
      <text x="0" y="${y + 4}" font-size="12" fill="#52525b">${escapeSvg(item.label)}</text>
      <rect x="${trackX}" y="${trackY}" width="${chartWidth}" height="10" rx="5" fill="#f4f4f5" />
      ${fillWidth > 0 ? `<rect x="${trackX}" y="${trackY}" width="${fillWidth.toFixed(1)}" height="10" rx="5" fill="${color}" />` : ''}
      <text x="${width - 2}" y="${y + 4}" text-anchor="end" font-size="12" font-weight="600" fill="#18181b">${escapeSvg(formatScoreLabel(numericValue))}</text>
    `
  }).join('')

  return `<svg class="chart-svg chart-bars" width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Score breakdown chart">${rows}</svg>`
}

export function renderLineTrendSvg(
  points: ChartTrendPoint[],
  options: { title?: string, yMin?: number, yMax?: number, height?: number, width?: number, bare?: boolean } = {}
): string {
  const values = points.map(point => point.value).filter((value): value is number => value != null)
  if (values.length < 2) {
    return '<p class="section-meta">Not enough scan history to show a trend yet.</p>'
  }

  const width = options.width ?? 540
  const height = options.height ?? 168
  const padX = 18
  const padY = 14
  const plotW = width - padX * 2
  const plotH = height - padY * 2 - 8
  const yMin = options.yMin ?? 0
  const yMax = options.yMax ?? Math.max(...values, 1)

  const coords = points.map((point, index) => {
    const x = padX + (index / Math.max(points.length - 1, 1)) * plotW
    const value = point.value ?? yMin
    const ratio = yMax === yMin ? 0 : (value - yMin) / (yMax - yMin)
    const y = padY + plotH - ratio * plotH
    return { x, y, label: point.label, value: point.value }
  })

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
  const last = coords[coords.length - 1]!

  const svg = `<svg class="chart-svg chart-trend" width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="${escapeSvg(options.title ?? 'Trend chart')}">
    <path d="${area}" fill="#dcfce7" />
    <path d="${line}" fill="none" stroke="#16a34a" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" fill="#16a34a" />
    <text x="${padX}" y="${height - 2}" font-size="9" fill="#a1a1aa">${escapeSvg(points[0]?.label ?? '')}</text>
    <text x="${width - padX}" y="${height - 2}" text-anchor="end" font-size="9" fill="#a1a1aa">${escapeSvg(points[points.length - 1]?.label ?? '')}</text>
  </svg>`

  if (options.bare) return svg
  return `<div class="trend-panel">${svg}</div>`
}

export interface ConformanceRow {
  badge: string
  badgeClass: string
  label: string
  score: number | null
}

/** Matches the app ScoreDetailRow: badge + label + score% + colored bar. */
export function renderConformanceRows(rows: ConformanceRow[]): string {
  if (!rows.length) {
    return '<p class="section-meta">No conformance levels available.</p>'
  }

  return `<div class="conformance-rows">${rows.map((row) => {
    const score = row.score
    const color = score == null ? '#d4d4d8' : scoreRingColor(score)
    const width = score == null ? 0 : Math.max(2, Math.min(100, score))
    return `
      <div class="conformance-row">
        <div class="conformance-row-head">
          <span class="site-target-badge ${escapeSvg(row.badgeClass)}">${escapeSvg(row.badge)}</span>
          <span class="conformance-row-label">${escapeSvg(row.label)}</span>
          <span class="conformance-row-score" style="color:${color}">${escapeSvg(formatScoreLabel(score))}%</span>
        </div>
        <div class="conformance-row-track">
          <div class="conformance-row-fill" style="width:${width.toFixed(1)}%;background:${color};"></div>
        </div>
      </div>
    `
  }).join('')}</div>`
}

function latestTrendValue(points: ChartTrendPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const value = points[i]?.value
    if (value != null) return value
  }
  return null
}

/** Matches the app MetricTrendCard: title, large value, subtitle, sparkline. */
export function renderMetricTrendCard(input: {
  title: string
  subtitle: string
  points: ChartTrendPoint[]
  valueSuffix?: string
  yMin?: number
  yMax?: number
  formatValue?: (value: number) => string
}): string {
  const latest = latestTrendValue(input.points)
  const display = latest == null
    ? '—'
    : (input.formatValue?.(latest) ?? `${formatScoreLabel(latest)}${input.valueSuffix ?? ''}`)
  const chart = renderLineTrendSvg(input.points, {
    title: input.title,
    yMin: input.yMin,
    yMax: input.yMax,
    height: 110,
    width: 420,
    bare: true
  })

  return `
    <article class="metric-trend-card">
      <p class="metric-trend-title">${escapeSvg(input.title)}</p>
      <p class="metric-trend-value">${escapeSvg(display)}</p>
      <p class="metric-trend-subtitle">${escapeSvg(input.subtitle)}</p>
      <div class="metric-trend-chart">${chart}</div>
    </article>
  `
}

export function renderMetricCards(
  cards: Array<{ label: string, value: string, tone?: MetricTone }>,
  options: { columns?: 2 | 3 | 4 } = {}
): string {
  const columns = options.columns ?? Math.min(4, Math.max(1, cards.length)) as 2 | 3 | 4
  const rows: string[] = []
  for (let i = 0; i < cards.length; i += columns) {
    const slice = cards.slice(i, i + columns)
    while (slice.length < columns) {
      slice.push({ label: '', value: '' })
    }
    rows.push(`<tr>${slice.map((card) => {
      if (!card.label && !card.value) {
        return `<td class="metric-card-cell"></td>`
      }
      const toneClass = card.tone ? `metric-card-${card.tone}` : ''
      return `
        <td class="metric-card-cell">
          <article class="metric-card ${toneClass}">
            <p class="metric-label">${escapeSvg(card.label)}</p>
            <p class="metric-value">${escapeSvg(card.value)}</p>
          </article>
        </td>
      `
    }).join('')}</tr>`)
  }
  return `<table class="metric-card-table metric-card-table--cols-${columns}" role="presentation">${rows.join('')}</table>`
}

export function countTone(count: number): MetricTone {
  if (count === 0) return 'good'
  if (count <= 10) return 'warn'
  return 'bad'
}

export function impactTone(impact: string): MetricTone {
  const key = impact.toLowerCase()
  if (key === 'critical' || key === 'serious' || key === 'moderate' || key === 'minor') return key
  return 'neutral'
}

