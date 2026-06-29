import type { TenantContext } from '~/types/tenant'

export default defineEventHandler(async (event): Promise<TenantContext> => {
  return resolveTenantContextFromEvent(event)
})
