export type A11yCheckWcagLevel = 'A' | 'AA' | 'AAA'

export interface A11yCheckCatalogEntry {
  rule_id: string
  wcag_level: A11yCheckWcagLevel
  is_best_practice: boolean
}

export interface A11yCheckRuleStats {
  failed: number
  passed: number
  incomplete: number
}

export interface A11yCheckStats {
  catalog: A11yCheckCatalogEntry[]
  rules: Record<string, A11yCheckRuleStats>
}

export function emptyA11yCheckStats(): A11yCheckStats {
  return { catalog: [], rules: {} }
}

export function emptyRuleStats(): A11yCheckRuleStats {
  return { failed: 0, passed: 0, incomplete: 0 }
}

export function mergeA11yCheckStats(parts: Array<A11yCheckStats | undefined | null>): A11yCheckStats {
  const catalog = new Map<string, A11yCheckCatalogEntry>()
  const rules: Record<string, A11yCheckRuleStats> = {}

  for (const part of parts) {
    if (!part) continue
    for (const entry of part.catalog ?? []) {
      if (entry?.rule_id && !catalog.has(entry.rule_id)) {
        catalog.set(entry.rule_id, {
          rule_id: entry.rule_id,
          wcag_level: entry.wcag_level === 'A' || entry.wcag_level === 'AAA' ? entry.wcag_level : 'AA',
          is_best_practice: Boolean(entry.is_best_practice)
        })
      }
    }
    for (const [ruleId, counts] of Object.entries(part.rules ?? {})) {
      const existing = rules[ruleId] ?? emptyRuleStats()
      rules[ruleId] = {
        failed: existing.failed + (Number(counts?.failed) || 0),
        passed: existing.passed + (Number(counts?.passed) || 0),
        incomplete: existing.incomplete + (Number(counts?.incomplete) || 0)
      }
    }
  }

  return { catalog: [...catalog.values()], rules }
}

export function parseA11yCheckStats(raw: unknown): A11yCheckStats | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as { catalog?: unknown, rules?: unknown }
  const catalog: A11yCheckCatalogEntry[] = []
  if (Array.isArray(o.catalog)) {
    for (const entry of o.catalog) {
      if (!entry || typeof entry !== 'object') continue
      const ruleId = String((entry as { rule_id?: unknown }).rule_id ?? '')
      if (!ruleId) continue
      const level = (entry as { wcag_level?: unknown }).wcag_level
      catalog.push({
        rule_id: ruleId,
        wcag_level: level === 'A' || level === 'AAA' ? level : 'AA',
        is_best_practice: Boolean((entry as { is_best_practice?: unknown }).is_best_practice)
      })
    }
  }
  const rules: Record<string, A11yCheckRuleStats> = {}
  if (o.rules && typeof o.rules === 'object') {
    for (const [ruleId, counts] of Object.entries(o.rules as Record<string, unknown>)) {
      if (!counts || typeof counts !== 'object') continue
      const c = counts as Record<string, unknown>
      rules[ruleId] = {
        failed: Math.max(0, Number(c.failed) || 0),
        passed: Math.max(0, Number(c.passed) || 0),
        incomplete: Math.max(0, Number(c.incomplete) || 0)
      }
    }
  }
  if (!catalog.length && !Object.keys(rules).length) return undefined
  return { catalog, rules }
}
