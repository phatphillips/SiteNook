import { runAnalyticsSyncTick } from '../utils/analytics/sync'

let tickInFlight = false

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const enabled = String(config.analyticsSyncEnabled || '1') !== '0'
  if (!enabled) return

  const tickMs = Math.max(60_000, Number(config.analyticsSyncTickMs) || 300_000)

  const run = async () => {
    if (tickInFlight) return
    tickInFlight = true
    try {
      await runAnalyticsSyncTick()
    } catch (error) {
      console.warn('[analytics-sync] tick failed:', error)
    } finally {
      tickInFlight = false
    }
  }

  // Delay first tick so PocketBase/admin auth is ready
  const startup = setTimeout(() => {
    void run()
  }, 15_000)

  const timer = setInterval(() => {
    void run()
  }, tickMs)

  nitroApp.hooks.hook('close', () => {
    clearTimeout(startup)
    clearInterval(timer)
  })
})
