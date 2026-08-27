import axe from 'axe-core'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TAGS = [
  'wcag2a', 'wcag2aa', 'wcag2aaa',
  'wcag21a', 'wcag21aa', 'wcag21aaa',
  'wcag22a', 'wcag22aa', 'wcag22aaa',
  'best-practice'
]
const LEVEL = {
  wcag2a: 'A', wcag21a: 'A', wcag22a: 'A',
  wcag2aa: 'AA', wcag21aa: 'AA', wcag22aa: 'AA',
  wcag2aaa: 'AAA', wcag21aaa: 'AAA', wcag22aaa: 'AAA'
}

function entry(rule) {
  const tags = rule.tags || []
  let wcag_level = 'AA'
  for (const tag of tags) {
    if (LEVEL[tag]) {
      wcag_level = LEVEL[tag]
      break
    }
  }
  const is_best_practice = tags.includes('best-practice') && !tags.some(tag => LEVEL[tag])
  return { rule_id: rule.ruleId, wcag_level, is_best_practice }
}

const catalog = axe.getRules(TAGS).map(entry)
const header = `/**
 * Fallback axe-core check catalog (WCAG + best-practice tags).
 * Used when a scan has no persisted a11y_check_stats.
 * Generated from axe-core ${axe.version}.
 */
import type { A11yCheckCatalogEntry } from './a11yCheckStats.js'

export const FALLBACK_AXE_CATALOG: readonly A11yCheckCatalogEntry[] = `

const json = JSON.stringify(catalog, null, 2)
  .replace(/"([A-Za-z_]+)":/g, '$1:')
  .replace(/"A"/g, "'A'")
  .replace(/"AA"/g, "'AA'")
  .replace(/"AAA"/g, "'AAA'")

const scannerDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'accessibility')
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'app', 'utils')

const scannerBody = `${header}${json} as const\n`
const webBody = scannerBody.replace("from './a11yCheckStats.js'", "from './a11yCheckStats'")

writeFileSync(join(scannerDir, 'axeCheckCatalog.ts'), scannerBody)
writeFileSync(join(webDir, 'axeCheckCatalog.ts'), webBody)
console.log('wrote catalogs', catalog.length, 'axe', axe.version)
