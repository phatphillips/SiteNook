import { ensureHelpIndex } from '../utils/helpTypesense'
import { isTypesenseEnabled } from '../utils/typesenseConfig'

export default defineNitroPlugin(() => {
  if (!isTypesenseEnabled()) return
  // Defer so boot is not blocked on Typesense
  setTimeout(() => {
    void ensureHelpIndex()
  }, 1500)
})
