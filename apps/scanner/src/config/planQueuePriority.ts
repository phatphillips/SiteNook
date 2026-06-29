import { normalizeOrganizationPlan } from './planLimits.js'

/** Higher priority runs first in scan_queue sort (-priority,id). */
export function queuePriorityForPlan(plan: unknown): number {
  switch (normalizeOrganizationPlan(plan)) {
    case 'enterprise':
      return 100
    case 'business':
      return 75
    case 'team':
      return 50
    case 'starter':
      return 25
    default:
      return 0
  }
}
