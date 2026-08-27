import { useLocalStorage } from '@vueuse/core'
import {
  DEFAULT_DASHBOARD_SECTION_ORDER,
  DASHBOARD_SECTION_STORAGE_KEY,
  readDashboardSectionOrderForOrg,
  writeDashboardSectionOrderForOrg,
  type DashboardSectionId
} from '~/utils/dashboardSectionOrder'

export function useDashboardSectionOrder() {
  const { organization } = useTenantOrg()
  const orgId = computed(() => organization.value?.id ?? null)

  const storedByOrg = useLocalStorage<Record<string, DashboardSectionId[]>>(
    DASHBOARD_SECTION_STORAGE_KEY,
    {}
  )

  const sectionOrder = ref<DashboardSectionId[]>([...DEFAULT_DASHBOARD_SECTION_ORDER])

  function syncFromStorage() {
    sectionOrder.value = readDashboardSectionOrderForOrg(storedByOrg.value, orgId.value)
  }

  watch(orgId, syncFromStorage, { immediate: true })

  watch(
    sectionOrder,
    (order) => {
      storedByOrg.value = writeDashboardSectionOrderForOrg(
        storedByOrg.value,
        orgId.value,
        order
      )
    },
    { deep: true }
  )

  return {
    sectionOrder,
    syncFromStorage
  }
}
