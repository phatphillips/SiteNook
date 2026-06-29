import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function applyEnvFile(path: string): void {
  if (!existsSync(path)) return
  const vars = parseEnvFile(readFileSync(path, 'utf8'))
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * Load `.env` for local scanner scripts. Does not override variables already set in the shell.
 * Checks `apps/scanner/.env`, repo root `.env`, and maps `PB_ADMIN_*` → `POCKETBASE_ADMIN_*`.
 */
export function loadScannerEnv(): void {
  const cwd = process.cwd()
  applyEnvFile(resolve(cwd, '.env'))
  applyEnvFile(resolve(cwd, '../.env'))
  applyEnvFile(resolve(cwd, '../../.env'))

  if (!process.env.POCKETBASE_ADMIN_EMAIL?.trim() && process.env.PB_ADMIN_EMAIL?.trim()) {
    process.env.POCKETBASE_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL.trim()
  }
  if (!process.env.POCKETBASE_ADMIN_PASSWORD && process.env.PB_ADMIN_PASSWORD) {
    process.env.POCKETBASE_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
  }
}
