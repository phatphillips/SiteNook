<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

import ApplianceLicenceBanner from '~/components/shared/ApplianceLicenceBanner.vue'
import SiteNookLogo from '~/components/shared/SiteNookLogo.vue'
import { buildOrgFeatureNavLinks, buildSiteFeatureNavLinks, isRootOverviewPath } from '~/utils/featureNavLinks'

const route = useRoute()
const { activeSiteId, isAllSites, fetchSites } = useSites()
const { isBusy: scanBusy } = useActiveWorkspaceScanState()
const { open: addSiteOpen } = useAddSiteWizard()

const open = ref(false)
const logoShine = ref(false)
let logoShineTimer: ReturnType<typeof setTimeout> | undefined

function triggerLogoShine() {
  logoShine.value = false
  void nextTick(() => {
    logoShine.value = true
    clearTimeout(logoShineTimer)
    logoShineTimer = setTimeout(() => {
      logoShine.value = false
    }, 1150)
  })
}

onMounted(async () => {
  const nuxtApp = useNuxtApp()
  nuxtApp.hook('page:start', () => {
    triggerLogoShine()
  })

  const { awaitAuthReady, isAuthenticated } = usePocketBase()
  await awaitAuthReady()
  if (isAuthenticated.value) {
    await fetchSites()
  }
})

onBeforeUnmount(() => {
  clearTimeout(logoShineTimer)
})

const featureLinks = computed<NavigationMenuItem[]>(() => {
  const onClose = () => { open.value = false }
  if (isAllSites.value) {
    return buildOrgFeatureNavLinks(route.path, onClose)
  }
  if (!activeSiteId.value) return []
  return buildSiteFeatureNavLinks(activeSiteId.value, route.path, onClose)
})

const links = computed<NavigationMenuItem[][]>(() => {
  const config = useRuntimeConfig()
  const commercialOn = (() => {
    const value = String(config.public.commercialEnabled ?? '').trim().toLowerCase()
    return value === 'true' || value === '1' || value === 'yes' || value === 'on'
  })()

  const settingsChildren: NavigationMenuItem[] = [{
    label: 'General',
    to: '/settings',
    exact: true,
    onSelect: () => { open.value = false }
  }, {
    label: 'Team',
    to: '/settings/users',
    onSelect: () => { open.value = false }
  }]
  if (commercialOn) {
    settingsChildren.push({
      label: 'Billing & Invoices',
      to: '/settings/billing',
      onSelect: () => { open.value = false }
    })
  }
  settingsChildren.push({
    label: 'Integrations',
    to: '/settings/integrations',
    onSelect: () => { open.value = false }
  })

  return [[{
    label: 'Overview',
    icon: 'i-lucide-house',
    to: isAllSites.value || !activeSiteId.value ? '/' : `/sites/${activeSiteId.value}`,
    active: isRootOverviewPath(route.path),
    onSelect: () => { open.value = false }
  }, {
    label: 'Sites',
    icon: 'i-lucide-globe',
    to: '/sites',
    onSelect: () => { open.value = false }
  }, {
    label: 'Search',
    icon: 'i-lucide-search',
    to: '/search',
    onSelect: () => { open.value = false }
  }, {
    label: 'Content',
    icon: 'i-lucide-files',
    to: isAllSites.value || !activeSiteId.value
      ? '/content/explorer'
      : `/sites/${activeSiteId.value}/content/explorer`,
    active: route.path === '/content/explorer'
      || /^\/sites\/[^/]+\/content\/explorer$/.test(route.path),
    onSelect: () => { open.value = false }
  }, ...featureLinks.value, {
    label: 'Scans',
    icon: 'i-lucide-history',
    to: '/scans',
    slot: 'scans',
    onSelect: () => { open.value = false }
  }, {
    label: 'Reports',
    icon: 'i-lucide-bar-chart-3',
    to: '/reports',
    onSelect: () => { open.value = false }
  }, {
    label: 'Policies',
    icon: 'i-lucide-clipboard-list',
    to: '/policies',
    onSelect: () => { open.value = false }
  }], [{
    label: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings',
    defaultOpen: route.path.startsWith('/settings'),
    type: 'trigger',
    children: settingsChildren
  }]]
})

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}])

const sidebarNavUi = {
  link: 'rounded-md px-3 py-2 font-medium text-[var(--sidebar-nav-fg)] before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
  childLink: 'rounded-md px-3 py-2 font-medium text-[var(--sidebar-nav-fg)] before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
  linkLeadingIcon: 'text-[var(--sidebar-nav-icon)] group-data-[active=true]:text-highlighted',
  childLinkIcon: 'text-[var(--sidebar-nav-icon)] group-data-[active=true]:text-highlighted'
}
</script>

<template>
  <UDashboardGroup
    unit="rem"
    class="flex-col"
  >
    <ApplianceLicenceBanner />

    <header class="dashboard-app-header">
      <div class="dashboard-app-header-left">
        <UDashboardSidebarToggle
          class="lg:hidden"
          color="neutral"
          variant="ghost"
          :ui="{ leadingIcon: 'size-4' }"
        />
        <NuxtLink
          to="/"
          class="dashboard-app-header-logo"
          aria-label="SiteNook home"
        >
          <SiteNookLogo
            size="sm"
            :shine="logoShine"
          />
        </NuxtLink>
        <WorkspaceSwitcher variant="navbar" />
      </div>
      <div class="dashboard-app-header-right">
        <div
          id="dashboard-app-header-actions"
          class="dashboard-app-header-actions-slot"
        />
        <UserMenu variant="header" />
      </div>
    </header>

    <div class="dashboard-app-body">
      <UDashboardSidebar
        id="default"
        v-model:open="open"
        mode="slideover"
        resizable
        class="dashboard-sidebar"
        :menu="{ side: 'left' }"
        :ui="{
          body: 'flex flex-col gap-2 flex-1 overflow-y-auto px-4 pt-2 pb-2',
          content: 'lg:hidden w-72 max-w-[calc(100vw-2.5rem)]',
          overlay: 'lg:hidden bg-black/20'
        }"
      >
        <template #default="{ collapsed }">
          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[0]"
            orientation="vertical"
            variant="pill"
            tooltip
            popover
            :ui="sidebarNavUi"
            class="dashboard-sidebar-nav"
          >
            <template #scans-label="{ item }">
              <span class="inline-flex items-center gap-1.5">
                <span>{{ item.label }}</span>
                <span
                  v-if="scanBusy"
                  class="scans-nav-pulse"
                  role="status"
                  aria-label="Scan in progress"
                >
                  <span class="scans-nav-pulse__dot" />
                  <span class="scans-nav-pulse__ring" aria-hidden="true" />
                </span>
              </span>
            </template>
          </UNavigationMenu>
          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[1]"
            orientation="vertical"
            variant="pill"
            tooltip
            popover
            :ui="sidebarNavUi"
            class="dashboard-sidebar-nav mt-auto shrink-0"
          />
        </template>

        <template #resize-handle="{ onMouseDown, onTouchStart, onDoubleClick, ui: sidebarUi }">
          <UDashboardResizeHandle
            aria-controls="dashboard-sidebar-default"
            data-slot="handle"
            class="sidebar-resize-handle"
            :class="sidebarUi.handle()"
            @mousedown="onMouseDown"
            @touchstart="onTouchStart"
            @dblclick="onDoubleClick"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="sidebar-resize-handle-grip size-4"
              aria-hidden="true"
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </UDashboardResizeHandle>
        </template>
      </UDashboardSidebar>

      <div class="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
        <UDashboardSearch :groups="groups" />
        <div class="min-h-0 flex-1 flex flex-col overflow-hidden">
          <slot />
        </div>
      </div>
    </div>

    <AddSiteWizard v-model:open="addSiteOpen" />
  </UDashboardGroup>
</template>

<style scoped>
.scans-nav-pulse {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
}

.scans-nav-pulse__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: #f97316;
  box-shadow: 0 0 0 1px color-mix(in srgb, #f97316 40%, transparent);
}

.scans-nav-pulse__ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  border: 1.5px solid #f97316;
  opacity: 0.75;
  animation: scans-nav-pulse-ring 1.4s ease-out infinite;
}

@keyframes scans-nav-pulse-ring {
  0% {
    transform: scale(0.55);
    opacity: 0.8;
  }
  70% {
    transform: scale(1.65);
    opacity: 0;
  }
  100% {
    transform: scale(1.65);
    opacity: 0;
  }
}
</style>
