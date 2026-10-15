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
  /** `sidebar` keeps a compact icon trigger; `navbar` is a Kumo-style Select. */
  variant?: 'sidebar' | 'navbar'
}>(), {
  collapsed: false,
  variant: 'navbar'
})

const open = ref(false)
const search = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const fieldRef = ref<HTMLElement | null>(null)
const listboxRef = ref<HTMLElement | null>(null)
const highlightIndex = ref(0)
const listboxStyle = ref<Record<string, string>>({})

const isNavbar = computed(() => props.variant === 'navbar')
const isCollapsed = computed(() => props.collapsed && !isNavbar.value)

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
    return `Switch site. ${organization.value?.name ?? 'SiteNook'}. All sites`
  }
  const stateLabel = workspaceScanStateLabel(displayState.value)
  return `Switch site. ${organization.value?.name ?? 'SiteNook'}. ${activeSiteName.value}. ${stateLabel}`
})

type SwitcherOption = {
  id: string
  label: string
  kind: 'all' | 'site'
}

const allOptions = computed<SwitcherOption[]>(() => [
  { id: '__all__', label: 'All sites', kind: 'all' },
  ...sites.value.map(site => ({
    id: site.id,
    label: site.name,
    kind: 'site' as const
  }))
])

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return allOptions.value
  return allOptions.value.filter((option) => {
    if (option.kind === 'all') {
      return 'all sites'.includes(query)
    }
    const site = sites.value.find(s => s.id === option.id)
    if (!site) return option.label.toLowerCase().includes(query)
    return site.name.toLowerCase().includes(query)
      || site.url.toLowerCase().includes(query)
  })
})

function isOptionActive(option: SwitcherOption) {
  if (option.kind === 'all') return isAllSites.value
  return !isAllSites.value && option.id === activeSiteId.value
}

async function onSelectAllSites() {
  if (isAllSites.value) {
    closeCombobox()
    return
  }
  selectAllSites()
  const nextPath = pathAfterSelectAllSites(route.path)
  if (nextPath && nextPath !== route.path) {
    await navigateTo(nextPath)
  }
  closeCombobox()
}

async function onSelectSite(siteId: string) {
  if (!siteId || (!isAllSites.value && siteId === activeSiteId.value)) {
    closeCombobox()
    return
  }
  selectSite(siteId)
  const nextPath = pathAfterSelectSite(route.path, siteId)
  if (nextPath && nextPath !== route.path) {
    await navigateTo(nextPath)
  }
  closeCombobox()
}

async function selectOption(option: SwitcherOption) {
  if (option.kind === 'all') {
    await onSelectAllSites()
    return
  }
  await onSelectSite(option.id)
}

function updateListboxPosition() {
  const anchor = isNavbar.value ? fieldRef.value : rootRef.value
  if (!anchor || typeof window === 'undefined') return
  const rect = anchor.getBoundingClientRect()
  // Match Kumo Select demo: fixed 200px trigger + popup.
  const width = isNavbar.value ? 200 : Math.max(rect.width, 200)
  const viewportPad = 8

  if (isNavbar.value) {
    const top = Math.round(rect.bottom + 6)
    const left = Math.min(rect.left, window.innerWidth - width - viewportPad)
    const maxHeight = Math.max(12 * 16, window.innerHeight - top - viewportPad)
    listboxStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${Math.round(Math.max(viewportPad, left))}px`,
      width: `${width}px`,
      maxWidth: `${width}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
      zIndex: '80'
    }
    return
  }

  // Sidebar: open to the right of the trigger when space allows.
  const preferredLeft = rect.right + 6
  const left = preferredLeft + width <= window.innerWidth - viewportPad
    ? preferredLeft
    : Math.max(viewportPad, rect.left)
  const top = Math.round(rect.top)
  const maxHeight = Math.max(12 * 16, window.innerHeight - top - viewportPad)
  listboxStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    zIndex: '80'
  }
}

function openCombobox() {
  if (open.value) return
  open.value = true
  search.value = ''
  highlightIndex.value = Math.max(0, filteredOptions.value.findIndex(isOptionActive))
  nextTick(() => {
    updateListboxPosition()
    inputRef.value?.focus()
  })
}

function closeCombobox() {
  open.value = false
  search.value = ''
  highlightIndex.value = 0
}

function toggleCombobox() {
  if (open.value) closeCombobox()
  else openCombobox()
}

function onSearchInput(event: Event) {
  search.value = (event.target as HTMLInputElement).value
  highlightIndex.value = 0
}

function moveHighlight(delta: 1 | -1) {
  const options = filteredOptions.value
  if (!options.length) return
  highlightIndex.value = Math.max(
    0,
    Math.min(options.length - 1, highlightIndex.value + delta)
  )
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) openCombobox()
    else moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!open.value) {
      openCombobox()
      return
    }
    const option = filteredOptions.value[highlightIndex.value]
    if (option) void selectOption(option)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeCombobox()
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = filteredOptions.value[highlightIndex.value]
    if (option) void selectOption(option)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeCombobox()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !rootRef.value) return
  const target = event.target as Node | null
  if (!target) return
  if (rootRef.value.contains(target)) return
  if (listboxRef.value?.contains(target)) return
  closeCombobox()
}

function onWindowReposition() {
  if (!open.value) return
  updateListboxPosition()
}

watch(open, (isOpen) => {
  if (!isOpen) search.value = ''
  else nextTick(() => updateListboxPosition())
})

watch(filteredOptions, (options) => {
  if (highlightIndex.value > options.length - 1) {
    highlightIndex.value = Math.max(0, options.length - 1)
  }
})

onMounted(async () => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', onWindowReposition)
  window.addEventListener('scroll', onWindowReposition, true)
  await awaitAuthReady()
  await fetchSites().catch(() => {})
  if (!isAllSites.value) {
    await refreshScanState()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', onWindowReposition)
  window.removeEventListener('scroll', onWindowReposition, true)
})
</script>

<template>
  <!-- Navbar: Kumo Select trigger (width follows selected label). -->
  <div
    v-if="isNavbar"
    ref="rootRef"
    class="workspace-combobox"
    :data-state="open ? 'open' : 'closed'"
  >
    <button
      ref="fieldRef"
      type="button"
      role="combobox"
      class="workspace-combobox-trigger"
      :aria-label="triggerAriaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      aria-controls="workspace-combobox-listbox"
      :aria-activedescendant="open && filteredOptions[highlightIndex]
        ? `workspace-option-${filteredOptions[highlightIndex].id}`
        : undefined"
      @click="toggleCombobox"
      @keydown="onTriggerKeydown"
    >
      <span
        class="workspace-combobox-value"
        :data-placeholder="activeSiteName === 'Select site' ? '' : undefined"
      >
        {{ activeSiteName }}
      </span>
      <span
        class="workspace-combobox-caret"
        aria-hidden="true"
      >
        <UIcon
          name="i-lucide-chevrons-up-down"
          class="size-4"
        />
      </span>
    </button>

    <Teleport to="body">
      <div
        v-show="open"
        id="workspace-combobox-listbox"
        ref="listboxRef"
        class="workspace-combobox-content workspace-combobox-content--portal"
        role="presentation"
        :style="listboxStyle"
      >
        <div
          v-if="sites.length"
          class="workspace-combobox-search-wrap"
        >
          <input
            ref="inputRef"
            type="text"
            class="workspace-combobox-search"
            :value="search"
            placeholder="Search…"
            autocomplete="off"
            aria-label="Search sites"
            @input="onSearchInput"
            @keydown="onSearchKeydown"
          >
        </div>
        <p
          v-if="!sites.length"
          class="workspace-switcher-empty"
        >
          No sites yet.
        </p>
        <p
          v-else-if="!filteredOptions.length"
          class="workspace-switcher-empty"
        >
          No sites match your search.
        </p>
        <ul
          v-else
          class="workspace-combobox-list scroll-region"
          role="listbox"
        >
          <li
            v-for="(option, index) in filteredOptions"
            :id="`workspace-option-${option.id}`"
            :key="option.id"
            role="option"
            :aria-selected="isOptionActive(option)"
          >
            <button
              type="button"
              class="workspace-switcher-list-item"
              :class="{
                'workspace-switcher-list-item--active': isOptionActive(option),
                'workspace-switcher-list-item--highlight': index === highlightIndex
              }"
              @mouseenter="highlightIndex = index"
              @click="selectOption(option)"
            >
              <span class="truncate">{{ option.label }}</span>
              <UIcon
                v-if="isOptionActive(option)"
                name="i-lucide-check"
                class="workspace-switcher-list-check size-4 shrink-0"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
      </div>
    </Teleport>
  </div>

  <!-- Sidebar: compact custom trigger. -->
  <div
    v-else
    ref="rootRef"
    class="workspace-combobox workspace-combobox--sidebar"
    :data-state="open ? 'open' : 'closed'"
  >
    <button
      type="button"
      class="workspace-switcher-trigger"
      :class="[
        isCollapsed ? 'workspace-switcher-trigger--collapsed' : '',
        open ? 'workspace-switcher-trigger--open' : ''
      ]"
      :aria-label="triggerAriaLabel"
      :aria-expanded="open"
      @click="toggleCombobox"
    >
      <span
        class="workspace-switcher-icon"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-globe" class="size-4" />
      </span>
      <span
        v-if="!isCollapsed"
        class="workspace-switcher-label min-w-0 flex-1"
      >
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
        name="i-lucide-chevron-down"
        class="workspace-switcher-chevron size-4 shrink-0"
        :class="{ 'workspace-switcher-chevron--open': open }"
        aria-hidden="true"
      />
    </button>

    <Teleport to="body">
      <div
        v-show="open"
        ref="listboxRef"
        class="workspace-combobox-content workspace-combobox-content--portal"
        role="listbox"
        :style="listboxStyle"
      >
        <UInput
          v-model="search"
          placeholder="Search…"
          size="sm"
          variant="none"
          class="workspace-switcher-search w-full"
          :ui="{
            root: 'w-full',
            base: 'w-full px-2.5 py-2'
          }"
          autofocus
        />
        <div class="workspace-switcher-list scroll-region">
          <p
            v-if="!sites.length"
            class="workspace-switcher-empty"
          >
            No sites yet.
          </p>
          <p
            v-else-if="!filteredOptions.length"
            class="workspace-switcher-empty"
          >
            No sites match your search.
          </p>
          <ul v-else>
            <li
              v-for="option in filteredOptions"
              :key="option.id"
            >
              <button
                type="button"
                class="workspace-switcher-list-item"
                :class="{ 'workspace-switcher-list-item--active': isOptionActive(option) }"
                @click="selectOption(option)"
              >
                <span class="truncate">{{ option.label }}</span>
                <UIcon
                  v-if="isOptionActive(option)"
                  name="i-lucide-check"
                  class="workspace-switcher-list-check size-4 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
