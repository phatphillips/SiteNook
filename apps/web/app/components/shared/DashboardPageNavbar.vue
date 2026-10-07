<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <UDashboardNavbar
    class="dashboard-page-navbar -ms-[0.375rem] ps-[0.375rem]"
    :toggle="{
      color: 'neutral',
      variant: 'ghost',
      ui: { leadingIcon: 'size-4' }
    }"
  >
    <template #leading>
      <UDashboardSidebarCollapse
        :ui="{ leadingIcon: 'size-4' }"
      />
    </template>
    <template #title>
      <div class="dashboard-page-navbar-title-row flex min-w-0 items-center gap-2 sm:gap-2.5">
        <WorkspaceSwitcher variant="navbar" />
        <span
          class="dashboard-page-navbar-divider shrink-0 text-muted"
          aria-hidden="true"
        >/</span>
        <h1 class="dashboard-page-navbar-title min-w-0 shrink">
          <slot name="title">
            <span class="block truncate">{{ title }}</span>
          </slot>
        </h1>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing>
      <slot name="trailing" />
    </template>
    <template #right>
      <div class="flex items-center gap-2 sm:gap-3">
        <slot name="right" />
        <UserMenu variant="header" />
      </div>
    </template>
    <slot />
  </UDashboardNavbar>
</template>
