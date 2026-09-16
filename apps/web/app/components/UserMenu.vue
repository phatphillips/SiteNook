<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { APP_COLOR_MODES, type AppColorMode } from '~/utils/appTheme'

defineProps<{
  collapsed?: boolean
  variant?: 'sidebar' | 'header'
}>()

const colorMode = useColorMode()
const { sessionUser, logout } = usePocketBase()
const config = useRuntimeConfig()

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

function setColorMode(mode: AppColorMode) {
  colorMode.preference = mode
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
  children: APP_COLOR_MODES.map(mode => ({
    label: mode.label,
    icon: mode.icon,
    type: 'checkbox' as const,
    checked: colorMode.value === mode.value,
    onSelect(e: Event) {
      e.preventDefault()
      setColorMode(mode.value)
    }
  }))
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
    :ui="{ content: variant === 'header' ? 'w-56' : (collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)') }"
  >
    <button
      v-if="variant === 'header'"
      type="button"
      class="user-menu-header-trigger flex items-center rounded-lg p-1.5 text-left transition-colors hover:bg-elevated/60 data-[state=open]:bg-elevated/80"
      aria-label="Open account menu"
    >
      <UAvatar
        :text="avatarText"
        size="sm"
        class="shrink-0"
      />
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
  </UDropdownMenu>
</template>
