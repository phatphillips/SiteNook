import { buildHelpCatalog } from '../../utils/helpFs'
import { ensureHelpIndex } from '../../utils/helpTypesense'

export default defineEventHandler(async () => {
  // Warm Typesense in the background; catalog still works if search is down
  void ensureHelpIndex()
  return buildHelpCatalog()
})
