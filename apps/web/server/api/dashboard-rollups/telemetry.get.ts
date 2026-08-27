import { getDashboardRollupTelemetry } from '../../utils/dashboardRollupTelemetry'

export default defineEventHandler(async () => {
  return getDashboardRollupTelemetry()
})
