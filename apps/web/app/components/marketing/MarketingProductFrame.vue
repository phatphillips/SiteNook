<script setup lang="ts">
import type { MarketingNavId } from '~/utils/marketingNav'

const props = withDefaults(defineProps<{
  url?: string
  activeNav?: MarketingNavId
  title?: string
  badge?: string | null
  /** Hide the demo sidebar — Cursor-style product panel without app nav. */
  hideNav?: boolean
  /** Hide the in-frame page title row (title lives in the showcase content instead). */
  hideTitleBar?: boolean
}>(), {
  url: 'app.sitenook.com',
  activeNav: 'overview',
  title: 'Acme Research',
  badge: 'Latest scan',
  hideNav: false,
  hideTitleBar: false
})

interface NavChild {
  id: MarketingNavId
  label: string
}

interface NavGroup {
  id: MarketingNavId
  label: string
  icon: string
  children?: NavChild[]
}

const topNav: NavGroup[] = [
  { id: 'overview', label: 'Overview', icon: 'i-lucide-house' },
  { id: 'sites', label: 'Sites', icon: 'i-lucide-globe' },
  { id: 'search', label: 'Search', icon: 'i-lucide-search' },
  {
    id: 'accessibility',
    label: 'Accessibility',
    icon: 'i-lucide-accessibility',
    children: [
      { id: 'accessibility-overview', label: 'Overview' },
      { id: 'accessibility-issues', label: 'Issues' },
      { id: 'accessibility-readability', label: 'Readability' },
      { id: 'accessibility-pdfs', label: 'PDFs' }
    ]
  },
  {
    id: 'qa',
    label: 'Quality Assurance',
    icon: 'i-lucide-shield-check',
    children: [
      { id: 'qa-overview', label: 'Overview' },
      { id: 'qa-links', label: 'Broken Links' },
      { id: 'qa-spelling', label: 'Spelling' },
      { id: 'qa-policies', label: 'Policies' },
      { id: 'qa-inventory', label: 'Inventory' }
    ]
  },
  {
    id: 'seo',
    label: 'SEO',
    icon: 'i-lucide-search',
    children: [
      { id: 'seo-overview', label: 'Overview' },
      { id: 'seo-technical', label: 'Technical' },
      { id: 'seo-content', label: 'Content' },
      { id: 'seo-preview', label: 'Search Result Preview' }
    ]
  },
  { id: 'scans', label: 'Scans', icon: 'i-lucide-history' },
  { id: 'reports', label: 'Reports', icon: 'i-lucide-bar-chart-3' },
  { id: 'policies', label: 'Policies', icon: 'i-lucide-clipboard-list' }
]

const settingsNav: NavGroup = {
  id: 'settings',
  label: 'Settings',
  icon: 'i-lucide-settings',
  children: [
    { id: 'settings-general', label: 'General' },
    { id: 'settings-team', label: 'Team' },
    { id: 'settings-billing', label: 'Billing & Invoices' },
    { id: 'settings-integrations', label: 'Integrations' }
  ]
}

const openGroups = ref<Set<string>>(new Set())

function parentOf(id: MarketingNavId): string | null {
  for (const group of [...topNav, settingsNav]) {
    if (group.children?.some(child => child.id === id)) return group.id
    if (group.id === id) return group.id
  }
  return null
}

watch(
  () => props.activeNav,
  (nav) => {
    const parent = parentOf(nav)
    if (parent) openGroups.value = new Set([...openGroups.value, parent])
  },
  { immediate: true }
)

function isGroupOpen(groupId: string) {
  return openGroups.value.has(groupId)
}

function toggleGroup(groupId: string) {
  const next = new Set(openGroups.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  openGroups.value = next
}

function isActive(id: MarketingNavId) {
  return props.activeNav === id
}

function isGroupActive(group: NavGroup) {
  if (isActive(group.id)) return true
  return group.children?.some(child => isActive(child.id)) ?? false
}

const hoveredId = ref<string | null>(null)
</script>

<template>
  <div
    class="marketing-product-frame overflow-x-clip rounded-2xl border border-default/80 bg-default ring-1 ring-default/40"
    :aria-label="`Product preview: ${title}`"
  >
    <div class="flex items-center gap-3 border-b border-default/70 bg-elevated/80 px-3 py-2.5">
      <div class="flex items-center gap-1.5" aria-hidden="true">
        <span class="size-2.5 rounded-full bg-red-400/80" />
        <span class="size-2.5 rounded-full bg-amber-400/80" />
        <span class="size-2.5 rounded-full bg-emerald-400/80" />
      </div>
      <div class="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-default/80 px-3 py-1 text-xs text-muted ring-1 ring-default/60">
        <UIcon name="i-lucide-lock" class="size-3 shrink-0 opacity-70" />
        <span class="truncate font-medium tracking-tight">{{ url }}</span>
      </div>
    </div>

    <div class="flex items-stretch">
      <aside
        v-if="!hideNav"
        class="hidden w-52 shrink-0 flex-col border-r border-default/70 bg-elevated/40 lg:flex"
        aria-label="Demo navigation"
      >
        <div class="flex items-center gap-2 border-b border-default/60 px-3 py-3">
          <UIcon name="i-lucide-search-check" class="size-4 text-primary" />
          <span class="text-xs font-semibold tracking-tight text-highlighted">SiteNook</span>
        </div>

        <nav class="flex flex-col gap-4 p-2">
          <ul class="space-y-0.5">
            <li
              v-for="item in topNav"
              :key="item.id"
            >
              <button
                v-if="!item.children"
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors"
                :class="[
                  isActive(item.id)
                    ? 'bg-elevated text-highlighted ring-1 ring-default'
                    : 'text-muted hover:bg-elevated/80 hover:text-highlighted',
                  hoveredId === item.id && !isActive(item.id) ? 'bg-elevated/80 text-highlighted' : ''
                ]"
                @mouseenter="hoveredId = item.id"
                @mouseleave="hoveredId = null"
              >
                <UIcon :name="item.icon" class="size-3.5 shrink-0 opacity-80" />
                <span class="truncate">{{ item.label }}</span>
              </button>

              <div v-else>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors"
                  :class="[
                    isGroupActive(item)
                      ? 'text-highlighted'
                      : 'text-muted hover:bg-elevated/80 hover:text-highlighted',
                    hoveredId === item.id ? 'bg-elevated/80 text-highlighted' : ''
                  ]"
                  :aria-expanded="isGroupOpen(item.id)"
                  @click="toggleGroup(item.id)"
                  @mouseenter="hoveredId = item.id"
                  @mouseleave="hoveredId = null"
                >
                  <UIcon :name="item.icon" class="size-3.5 shrink-0 opacity-80" />
                  <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="size-3 shrink-0 opacity-60 transition-transform"
                    :class="isGroupOpen(item.id) ? 'rotate-0' : '-rotate-90'"
                  />
                </button>
                <ul
                  v-if="isGroupOpen(item.id)"
                  class="mt-0.5 space-y-0.5 border-l border-default/70 ms-3.5 ps-2"
                >
                  <li
                    v-for="child in item.children"
                    :key="child.id"
                  >
                    <button
                      type="button"
                      class="w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                      :class="[
                        isActive(child.id)
                          ? 'bg-elevated font-medium text-highlighted ring-1 ring-default'
                          : 'text-muted hover:bg-elevated/80 hover:text-highlighted'
                      ]"
                      @mouseenter="hoveredId = child.id"
                      @mouseleave="hoveredId = null"
                    >
                      {{ child.label }}
                    </button>
                  </li>
                </ul>
              </div>
            </li>
          </ul>

          <ul class="space-y-0.5 border-t border-default/60 pt-2">
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors"
                :class="[
                  isGroupActive(settingsNav)
                    ? 'text-highlighted'
                    : 'text-muted hover:bg-elevated/80 hover:text-highlighted',
                  hoveredId === settingsNav.id ? 'bg-elevated/80 text-highlighted' : ''
                ]"
                :aria-expanded="isGroupOpen(settingsNav.id)"
                @click="toggleGroup(settingsNav.id)"
                @mouseenter="hoveredId = settingsNav.id"
                @mouseleave="hoveredId = null"
              >
                <UIcon :name="settingsNav.icon" class="size-3.5 shrink-0 opacity-80" />
                <span class="min-w-0 flex-1 truncate">{{ settingsNav.label }}</span>
                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-3 shrink-0 opacity-60 transition-transform"
                  :class="isGroupOpen(settingsNav.id) ? 'rotate-0' : '-rotate-90'"
                />
              </button>
              <ul
                v-if="isGroupOpen(settingsNav.id)"
                class="mt-0.5 space-y-0.5 border-l border-default/70 ms-3.5 ps-2"
              >
                <li
                  v-for="child in settingsNav.children"
                  :key="child.id"
                >
                  <button
                    type="button"
                    class="w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors"
                    :class="[
                      isActive(child.id)
                        ? 'bg-elevated font-medium text-highlighted ring-1 ring-default'
                        : 'text-muted hover:bg-elevated/80 hover:text-highlighted'
                    ]"
                    @mouseenter="hoveredId = child.id"
                    @mouseleave="hoveredId = null"
                  >
                    {{ child.label }}
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <div
          v-if="!hideTitleBar"
          class="flex items-center justify-between gap-3 border-b border-default/60 px-4 py-3"
        >
          <h3 class="truncate text-sm font-semibold text-highlighted sm:text-base">
            {{ title }}
          </h3>
          <span
            v-if="badge"
            class="hidden rounded-md bg-elevated px-2 py-1 text-[10px] font-medium text-muted ring-1 ring-default sm:inline"
          >
            {{ badge }}
          </span>
        </div>
        <div class="marketing-product-frame__body p-4 sm:p-5">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marketing-product-frame {
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.28),
    0 12px 24px -8px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

/* Grow with content — page scrolls, not nested panels (Cursor-style mobile). */
.marketing-product-frame__body {
  overflow: visible;
  max-width: 100%;
}

.marketing-product-frame :deep(.table-surface),
.marketing-product-frame :deep(.overflow-x-auto),
.marketing-product-frame :deep(.overflow-auto),
.marketing-product-frame :deep(.overflow-y-auto),
.marketing-product-frame :deep(.issues-table-scroll),
.marketing-product-frame :deep(.readability-table-panel) {
  overflow: visible !important;
  max-height: none !important;
}

.marketing-product-frame :deep(.issues-table-scroll table),
.marketing-product-frame :deep(.readability-table-panel table) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100%;
}

/* Clip wide table cells on small screens instead of trapping touch scroll. */
@media (max-width: 1023px) {
  .marketing-product-frame :deep(.issues-table-scroll),
  .marketing-product-frame :deep(.table-surface),
  .marketing-product-frame :deep(.issues-table-panel) {
    overflow-x: clip !important;
  }

  .marketing-product-frame :deep(.issues-table-scroll--overflow-right) {
    box-shadow: none !important;
  }
}
</style>
