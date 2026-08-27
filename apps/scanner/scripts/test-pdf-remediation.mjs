#!/usr/bin/env node
/**
 * One-command PDF remediation smoke:
 * 1) Always runs scanner unit tests for remediator modules
 * 2) If PDF_REMEDIATION_LIVE=1, hits ODL(+optional veraPDF) with untagged-simple.pdf
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const scannerRoot = join(here, '..')
const fixture = join(scannerRoot, '../../tests/fixtures/pdfs/untagged-simple.pdf')

function runUnits() {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vitest', 'run', 'tests/unit/pdf'],
    { cwd: scannerRoot, stdio: 'inherit', shell: process.platform === 'win32' }
  )
  if (result.status !== 0) {
    console.error('FAIL unit pdf tests')
    process.exit(result.status || 1)
  }
}

async function liveSmoke() {
  if (!existsSync(fixture)) {
    console.error('FAIL missing fixture', fixture)
    process.exit(1)
  }
  const odl = (process.env.OPENDATALOADER_URL || 'http://localhost:8095').replace(/\/$/, '')
  const buffer = readFileSync(fixture)
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), 'untagged-simple.pdf')
  form.append('format', 'json,html,markdown')

  const structureRes = await fetch(`${odl}/api/convert`, { method: 'POST', body: form })
  if (!structureRes.ok) {
    console.error('FAIL ODL structure', structureRes.status, await structureRes.text())
    process.exit(1)
  }
  const structure = await structureRes.json()
  if (!structure.json || !structure.html || !structure.markdown) {
    console.error('FAIL ODL missing formats')
    process.exit(1)
  }

  const form2 = new FormData()
  form2.append('file', new Blob([buffer], { type: 'application/pdf' }), 'untagged-simple.pdf')
  form2.append('format', 'tagged-pdf')
  const taggedRes = await fetch(`${odl}/api/convert`, { method: 'POST', body: form2 })
  if (!taggedRes.ok) {
    console.error('FAIL ODL tagged', taggedRes.status, await taggedRes.text())
    process.exit(1)
  }
  const taggedBuf = Buffer.from(await taggedRes.arrayBuffer())
  if (taggedBuf.length < 100) {
    console.error('FAIL tagged artifact too small')
    process.exit(1)
  }

  console.log('PASS pdf-remediation live smoke (structure formats + tagged artifact)')
}

runUnits()
console.log('PASS pdf-remediation unit suite')

if (process.env.PDF_REMEDIATION_LIVE === '1') {
  liveSmoke().catch((err) => {
    console.error('FAIL live smoke', err)
    process.exit(1)
  })
} else {
  console.log('SKIP live ODL smoke (set PDF_REMEDIATION_LIVE=1 to enable)')
}
