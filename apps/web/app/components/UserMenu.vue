<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { APP_COLOR_MODES, type AppColorMode } from '~/utils/appTheme'

defineProps<{ collapsed?: boolean }>()

const colorMode = useColorMode()
const { sessionUser, logout } = usePocketBase()

const displayName = computed(() => sessionUser.value?.name || sessionUser.value?.email || 'User')

function setColorMode(mode: AppColorMode) {
  colorMode.preference = mode
}

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: displayName.value
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings'
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
  onSelect: () => logout()
}]])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
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
