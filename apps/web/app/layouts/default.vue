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

onMounted(async () => {
  const { awaitAuthReady, isAuthenticated } = usePocketBase()
  await awaitAuthReady()
  if (isAuthenticated.value) {
    await fetchSites()
  }
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
  link: 'rounded-md px-3 py-2 font-medium text-muted before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
  childLink: 'rounded-md px-3 py-2 font-medium text-muted before:rounded-md data-[active=true]:text-highlighted data-[active=true]:before:bg-[var(--sidebar-nav-active-bg)] data-[active=true]:before:opacity-100',
  linkLeadingIcon: 'text-dimmed group-data-[active=true]:text-highlighted',
  childLinkIcon: 'text-dimmed group-data-[active=true]:text-highlighted'
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      mode="slideover"
      collapsible
      resizable
      class="bg-elevated/25 !border-e-0"
      :menu="{ side: 'left' }"
      :ui="{
        header: 'h-(--ui-header-height) shrink-0 flex items-center gap-1.5 px-4',
        content: 'lg:hidden w-72 max-w-[calc(100vw-2.5rem)]',
        overlay: 'lg:hidden bg-black/20'
      }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex shrink-0 items-center rounded-md px-1 py-1 text-highlighted transition-colors hover:bg-[var(--sidebar-nav-hover-bg)]"
          aria-label="SiteNook home"
        >
          <SiteNookLogo size="sm" :compact="Boolean(collapsed)" />
        </NuxtLink>
      </template>

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
          :ui="sidebarNavUi"
          class="dashboard-sidebar-nav mt-auto"
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

    <div class="min-h-0 min-w-0 flex-1 flex flex-col h-full overflow-hidden">
      <ApplianceLicenceBanner />
      <UDashboardSearch :groups="groups" />
      <div class="min-h-0 flex-1 flex flex-col overflow-hidden">
        <slot />
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
