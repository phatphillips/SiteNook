import { syncChartPrimaryCssVars } from '~/utils/primaryColor'

/**
 * Initialise primary colour persistence (localStorage + cookie) and chart CSS sync.
 */
export default defineNuxtPlugin(() => {
  const colorMode = useColorMode()

  if (import.meta.client) {
    if (colorMode.preference === 'solarized-light' || colorMode.value === 'solarized-light') {
      colorMode.preference = 'light'
    }
  }

  usePrimaryColor()

  if (import.meta.client) {
    const runSync = () => syncChartPrimaryCssVars()
    requestAnimationFrame(() => {
      runSync()
      requestAnimationFrame(runSync)
    })

    watch(() => colorMode.value, () => {
      requestAnimationFrame(runSync)
    })
  }
})
