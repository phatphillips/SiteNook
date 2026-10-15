<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { APP_COLOR_MODES, type AppColorMode } from '~/utils/appTheme'
import { DEFAULT_PRIMARY_COLOR } from '~/utils/primaryColor'

defineProps<{
  collapsed?: boolean
  variant?: 'sidebar' | 'header'
}>()

const colorMode = useColorMode()
const { sessionUser, logout } = usePocketBase()
const config = useRuntimeConfig()
const appConfig = useAppConfig()
const { primary, primaryLabel, options: primaryOptions, setPrimaryColor } = usePrimaryColor()

const commercialEnabled = computed(() => {
  const value = String(config.public.commercialEnabled ?? '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
})

const displayName = computed(() => sessionUser.value?.name || sessionUser.value?.email || 'User')
const displayEmail = computed(() => {
  const email = sessionUser.value?.email
  if (typeof email === 'string' && email.trim()) return email
  return ''
})

const avatarText = computed(() => {
  const name = displayName.value.trim()
  if (!name) return 'U'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

const childrenChevron = computed(() =>
  (appConfig.ui.icons as { chevronRight?: string } | undefined)?.chevronRight || 'i-lucide-chevron-right'
)

function setColorMode(mode: AppColorMode) {
  colorMode.preference = mode
}

function colorSwatchStyle(color: string) {
  return { backgroundColor: `var(--color-${color}-500)` }
}

const settingsChildren = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = [
    {
      label: 'General',
      icon: 'i-lucide-settings-2',
      to: '/settings'
    },
    {
      label: 'Team',
      icon: 'i-lucide-users',
      to: '/settings/users'
    }
  ]
  if (commercialEnabled.value) {
    items.push({
      label: 'Billing & Invoices',
      icon: 'i-lucide-credit-card',
      to: '/settings/billing'
    })
  }
  items.push({
    label: 'Integrations',
    icon: 'i-lucide-plug',
    to: '/settings/integrations'
  })
  return items
})

const appearanceItemUi = {
  item: 'appearance-menu-item'
} as const

const appearanceChildren = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Default',
    icon: 'i-lucide-swatch-book',
    type: 'checkbox' as const,
    class: 'appearance-menu-item',
    ui: appearanceItemUi,
    checked: primary.value === DEFAULT_PRIMARY_COLOR,
    onSelect(e: Event) {
      e.preventDefault()
      setPrimaryColor(DEFAULT_PRIMARY_COLOR)
    }
  },
  ...APP_COLOR_MODES.map(mode => ({
    label: mode.label,
    icon: mode.icon,
    type: 'checkbox' as const,
    class: 'appearance-menu-item',
    ui: appearanceItemUi,
    checked: colorMode.value === mode.value,
    onSelect(e: Event) {
      e.preventDefault()
      setColorMode(mode.value)
    }
  })),
  { type: 'separator' as const },
  {
    label: 'Primary colour',
    icon: 'i-lucide-paintbrush',
    slot: 'primary-colour' as const,
    class: 'appearance-menu-item',
    ui: appearanceItemUi,
    chip: primary.value,
    content: { side: 'left' as const, align: 'start' as const },
    children: primaryOptions.map(option => ({
      label: option.label,
      chip: option.chip,
      slot: 'primary-swatch' as const,
      type: 'checkbox' as const,
      class: 'appearance-menu-item primary-color-option',
      ui: appearanceItemUi,
      checked: primary.value === option.value,
      onSelect(e: Event) {
        e.preventDefault()
        setPrimaryColor(option.value)
      }
    }))
  }
])

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: displayName.value,
  description: displayEmail.value || undefined
}], [{
  label: 'Account',
  icon: 'i-lucide-user',
  to: '/settings'
}, {
  label: 'Settings',
  icon: 'i-lucide-settings',
  children: settingsChildren.value
}], [{
  label: 'Appearance',
  icon: 'i-lucide-sun-moon',
  content: { side: 'left' as const, align: 'start' as const },
  children: appearanceChildren.value
}], [{
  label: 'Log out',
  icon: 'i-lucide-log-out',
  onSelect() {
    logout()
  }
}]])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end', collisionPadding: 12 }"
    :ui="{
      content: [
        'bg-elevated ring ring-default',
        variant === 'header' ? 'w-56' : (collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)')
      ].join(' ')
    }"
  >
    <button
      v-if="variant === 'header'"
      type="button"
      class="user-menu-header-trigger"
      aria-label="Open account menu"
    >
      <span class="user-menu-header-initials">{{ avatarText }}</span>
    </button>

    <UButton
      v-else
      :label="collapsed ? undefined : displayName"
      icon="i-lucide-user"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />

    <template #primary-colour-trailing="{ item, ui }">
      <span class="ms-auto inline-flex items-center gap-1.5">
        <span
          class="size-2 shrink-0 rounded-full"
          :style="colorSwatchStyle(String(item.chip || primary))"
        />
        <span class="text-muted text-sm">{{ primaryLabel }}</span>
        <UIcon
          :name="childrenChevron"
          data-slot="itemTrailingIcon"
          :class="ui.itemTrailingIcon({ class: 'text-dimmed' })"
        />
      </span>
    </template>

    <template #primary-swatch-leading="{ item }">
      <span class="size-5 shrink-0 flex items-center justify-center">
        <span
          class="size-2 rounded-full"
          :style="colorSwatchStyle(String(item.chip || 'blue'))"
        />
      </span>
    </template>
  </UDropdownMenu>
</template>

<style>
/* Appearance + primary colour menus (portaled; needs global selectors). */
.appearance-menu-item[data-highlighted]:not([data-disabled])::before,
.appearance-menu-item[data-state='open']:not([data-disabled])::before {
  background-color: var(--ui-bg-muted) !important;
  opacity: 1 !important;
}

.primary-color-option[data-highlighted]:not([data-disabled])::before {
  background-color: color-mix(in srgb, var(--ui-bg-muted) 85%, var(--ui-text) 8%) !important;
}
</style>
