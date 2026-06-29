export type TrafficLight = 'green' | 'orange' | 'red'

const SEO_SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

const AXE_IMPACT_RANK: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

export function trafficLightFromSeverity(severity: string | undefined | null): TrafficLight {
  const rank = SEO_SEVERITY_RANK[severity ?? ''] ?? 0
  if (rank >= 3) return 'red'
  if (rank >= 2) return 'orange'
  return 'green'
}

export function trafficLightFromImpact(impact: string | undefined | null): TrafficLight {
  const rank = AXE_IMPACT_RANK[impact ?? ''] ?? 0
  if (rank >= 3) return 'red'
  if (rank >= 2) return 'orange'
  return 'green'
}

export function trafficLightFromCount(count: number): TrafficLight {
  if (count === 0) return 'green'
  if (count <= 10) return 'orange'
  return 'red'
}

export function worstTrafficLight(lights: TrafficLight[]): TrafficLight {
  if (lights.includes('red')) return 'red'
  if (lights.includes('orange')) return 'orange'
  return 'green'
}

export function trafficLightClass(light: TrafficLight): string {
  if (light === 'green') return 'bg-green-500'
  if (light === 'orange') return 'bg-amber-500'
  return 'bg-red-500'
}
