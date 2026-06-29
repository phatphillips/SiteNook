<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { activeSiteId, fetchSites } = useSites()

const open = ref(false)

onMounted(() => fetchSites())

const siteLinks = computed<NavigationMenuItem[]>(() => {
  if (!activeSiteId.value) return []
  const id = activeSiteId.value
  return [{
    label: 'Accessibility',
    icon: 'i-lucide-accessibility',
    defaultOpen: route.path.includes(`/sites/${id}/accessibility`),
    type: 'trigger',
    children: [{
      label: 'Overview',
      to: `/sites/${id}/accessibility`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Issues',
      to: `/sites/${id}/accessibility/issues`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Readability',
      to: `/sites/${id}/accessibility/readability`,
      onSelect: () => { open.value = false }
    }, {
      label: 'PDFs',
      to: `/sites/${id}/accessibility/pdfs`,
      onSelect: () => { open.value = false }
    }]
  }, {
    label: 'Quality Assurance',
    icon: 'i-lucide-shield-check',
    defaultOpen: true,
    type: 'trigger',
    children: [{
      label: 'Overview',
      to: `/sites/${id}/qa`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Broken Links',
      to: `/sites/${id}/qa/links`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Spelling',
      to: `/sites/${id}/qa/spelling`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Inventory',
      to: `/sites/${id}/qa/inventory`,
      onSelect: () => { open.value = false }
    }]
  }, {
    label: 'SEO',
    icon: 'i-lucide-search',
    defaultOpen: route.path.includes(`/sites/${id}/seo`),
    type: 'trigger',
    children: [{
      label: 'Overview',
      to: `/sites/${id}/seo`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Technical',
      to: `/sites/${id}/seo/technical`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Content',
      to: `/sites/${id}/seo/content`,
      onSelect: () => { open.value = false }
    }, {
      label: 'Search Result Preview',
      to: `/sites/${id}/seo/preview`,
      onSelect: () => { open.value = false }
    }]
  }]
})

const links = computed<NavigationMenuItem[][]>(() => [[{
  label: 'Overview',
  icon: 'i-lucide-house',
  to: '/',
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
}, ...siteLinks.value, {
  label: 'Scans',
  icon: 'i-lucide-history',
  to: '/scans',
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
  children: [{
    label: 'General',
    to: '/settings',
    exact: true,
    onSelect: () => { open.value = false }
  }, {
    label: 'Team',
    to: '/settings/users',
    onSelect: () => { open.value = false }
  }, {
    label: 'Billing & Invoices',
    to: '/settings/billing',
    onSelect: () => { open.value = false }
  }, {
    label: 'Integrations',
    to: '/settings/integrations',
    onSelect: () => { open.value = false }
  }]
}]])

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-2 py-1">
          <UIcon name="i-lucide-search-check" class="size-6 text-primary shrink-0" />
          <span v-if="!collapsed" class="font-bold text-lg">AccessIQ</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <div class="min-w-0 flex-1">
      <UDashboardSearch :groups="groups" />
      <slot />
    </div>
  </UDashboardGroup>
</template>

