<script setup lang="ts">
import {
  workspaceScanStateEyebrowClass,
  workspaceScanStateLabel
} from '~/utils/workspaceScanState'
import {
  pathAfterSelectAllSites,
  pathAfterSelectSite
} from '~/utils/workspaceSwitchPath'

const props = withDefaults(defineProps<{
  collapsed?: boolean
  /** `sidebar` keeps a compact icon trigger; `navbar` sits beside page titles. */
  variant?: 'sidebar' | 'navbar'
}>(), {
  collapsed: false,
  variant: 'navbar'
})

const open = ref(false)
const search = ref('')

const isNavbar = computed(() => props.variant === 'navbar')
const isCollapsed = computed(() => props.collapsed && !isNavbar.value)

const popoverContent = computed(() =>
  isNavbar.value
    ? { align: 'start' as const, side: 'bottom' as const, sideOffset: 6 }
    : { align: 'start' as const, side: 'right' as const, sideOffset: 6 }
)

const {
  sites,
  activeSiteId,
  isAllSites,
  selectAllSites,
  selectSite,
  fetchSites
} = useSites()
const { organization } = useTenantOrg()
const route = useRoute()

const activeSiteName = computed(() =>
  isAllSites.value
    ? 'All sites'
    : sites.value.find(site => site.id === activeSiteId.value)?.name ?? 'Select site'
)

const {
  displayState,
  refresh: refreshScanState
} = useActiveWorkspaceScanState()

const { awaitAuthReady } = usePocketBase()

const showStatusEyebrow = computed(() =>
  !isNavbar.value
  && !isAllSites.value
  && (
    displayState.value === 'scanning'
    || displayState.value === 'queued'
    || displayState.value === 'failed'
    || displayState.value === 'never-scanned'
  )
)

const eyebrowText = computed(() =>
  workspaceScanStateLabel(displayState.value)
)

const eyebrowClass = computed(() =>
  workspaceScanStateEyebrowClass(displayState.value)
)

const triggerAriaLabel = computed(() => {
  if (isAllSites.value) {
    return `Switch site — ${organization.value?.name ?? 'SiteNook'} — All sites`
  }
  const stateLabel = workspaceScanStateLabel(displayState.value)
  return `Switch site — ${organization.value?.name ?? 'SiteNook'} — ${activeSiteName.value} — ${stateLabel}`
})

onMounted(async () => {
  await awaitAuthReady()
  await fetchSites().catch(() => {})
  if (!isAllSites.value) {
    await refreshScanState()
  }
})

const filteredSites = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return sites.value
  return sites.value.filter(site =>
    site.name.toLowerCase().includes(query)
    || site.url.toLowerCase().includes(query)
  )
})

async function onSelectAllSites() {
  if (isAllSites.value) {
    open.value = false
    return
  }
  selectAllSites()
  const nextPath = pathAfterSelectAllSites(route.path)
  if (nextPath && nextPath !== route.path) {
    await navigateTo(nextPath)
  }
  open.value = false
  search.value = ''
}

async function onSelectSite(siteId: string) {
  if (!siteId || (!isAllSites.value && siteId === activeSiteId.value)) {
    open.value = false
    return
  }
  selectSite(siteId)
  const nextPath = pathAfterSelectSite(route.path, siteId)
  if (nextPath && nextPath !== route.path) {
    await navigateTo(nextPath)
  }
  open.value = false
  search.value = ''
}

watch(open, (isOpen) => {
  if (!isOpen) search.value = ''
})
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="popoverContent"
  >
    <button
      type="button"
      class="workspace-switcher-trigger"
      :class="[
        isNavbar ? 'workspace-switcher-trigger--navbar' : '',
        isCollapsed ? 'workspace-switcher-trigger--collapsed' : '',
        open ? 'workspace-switcher-trigger--open' : ''
      ]"
      :aria-label="triggerAriaLabel"
      :aria-expanded="open"
    >
      <span
        v-if="!isNavbar"
        class="workspace-switcher-icon"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-search-check" class="size-4 text-primary" />
      </span>
      <span v-if="!isCollapsed" class="workspace-switcher-label min-w-0 flex-1">
        <span
          v-if="showStatusEyebrow"
          class="workspace-switcher-eyebrow"
          :class="eyebrowClass"
        >
          {{ eyebrowText }}
        </span>
        <span class="workspace-switcher-title">{{ activeSiteName }}</span>
      </span>
      <UIcon
        v-if="!isCollapsed"
        :name="isNavbar ? 'i-lucide-chevron-down' : 'i-lucide-chevrons-up-down'"
        class="workspace-switcher-chevron size-4 shrink-0"
        :class="open && isNavbar ? 'workspace-switcher-chevron--open' : ''"
        aria-hidden="true"
      />
    </button>

    <template #content>
      <div class="workspace-switcher-panel">
        <UInput
          v-model="search"
          placeholder="Search…"
          size="sm"
          variant="none"
          class="workspace-switcher-search"
          :ui="{ base: 'px-2 py-1.5' }"
          autofocus
        />
        <div class="workspace-switcher-list scroll-region">
          <p v-if="!sites.length" class="workspace-switcher-empty">
            No sites yet.
          </p>
          <template v-else>
            <ul>
              <li>
                <button
                  type="button"
                  class="workspace-switcher-list-item"
                  :class="{ 'workspace-switcher-list-item--active': isAllSites }"
                  @click="onSelectAllSites"
                >
                  <span class="truncate">All sites</span>
                  <UIcon
                    v-if="isAllSites"
                    name="i-lucide-check"
                    class="workspace-switcher-list-check size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
            <p v-if="search && !filteredSites.length" class="workspace-switcher-empty">
              No sites match your search.
            </p>
            <ul v-else-if="filteredSites.length">
              <li v-for="site in filteredSites" :key="site.id">
                <button
                  type="button"
                  class="workspace-switcher-list-item"
                  :class="{ 'workspace-switcher-list-item--active': !isAllSites && site.id === activeSiteId }"
                  @click="onSelectSite(site.id)"
                >
                  <span class="truncate">{{ site.name }}</span>
                  <UIcon
                    v-if="!isAllSites && site.id === activeSiteId"
                    name="i-lucide-check"
                    class="workspace-switcher-list-check size-4 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </template>
  </UPopover>
</template>
