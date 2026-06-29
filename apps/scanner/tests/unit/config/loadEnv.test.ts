import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadScannerEnv } from '../../../src/config/loadEnv.js'

const tmpDir = resolve(process.cwd(), 'tests/tmp-load-env')

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('loadScannerEnv', () => {
  it('maps PB_ADMIN_* to POCKETBASE_ADMIN_*', () => {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(
      resolve(tmpDir, '.env'),
      'PB_ADMIN_EMAIL=admin@test.local\nPB_ADMIN_PASSWORD=secret123\n'
    )

    const prevCwd = process.cwd()
    const keys = [
      'POCKETBASE_ADMIN_EMAIL',
      'POCKETBASE_ADMIN_PASSWORD',
      'PB_ADMIN_EMAIL',
      'PB_ADMIN_PASSWORD'
    ]
    const saved: Record<string, string | undefined> = {}
    for (const key of keys) {
      saved[key] = process.env[key]
      delete process.env[key]
    }

    try {
      process.chdir(tmpDir)
      loadScannerEnv()
      expect(process.env.POCKETBASE_ADMIN_EMAIL).toBe('admin@test.local')
      expect(process.env.POCKETBASE_ADMIN_PASSWORD).toBe('secret123')
    } finally {
      process.chdir(prevCwd)
      for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]
      }
    }
  })
})
