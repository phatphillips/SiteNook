import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsxCli = path.join(appRoot, 'node_modules/tsx/dist/cli.mjs')

let child = null
let restartTimer = null
let exiting = false

function start() {
  if (exiting || child) return
  console.log('[supervisor] starting scanner worker')
  child = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: appRoot,
    stdio: 'inherit',
    env: process.env
  })
  const current = child
  current.on('exit', (code, signal) => {
    if (child !== current) return
    child = null
    if (exiting) return
    console.error(
      `[supervisor] worker exited code=${code} signal=${signal || 'none'}; restarting in 2s`
    )
    setTimeout(start, 2000)
  })
}

function requestRestart() {
  if (exiting) return
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    restartTimer = null
    if (!child) {
      start()
      return
    }
    console.log('[supervisor] source changed; restarting worker')
    child.kill('SIGTERM')
  }, 400)
}

try {
  watch(path.join(appRoot, 'src'), { recursive: true }, requestRestart)
} catch (err) {
  console.warn('[supervisor] file watch unavailable:', err)
}

function shutdown(signal) {
  exiting = true
  child?.kill(signal)
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()
