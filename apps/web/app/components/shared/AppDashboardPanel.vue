<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <UDashboardPanel v-bind="$attrs">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <div class="dashboard-panel-body mx-auto flex w-full min-w-0 flex-col gap-4 sm:gap-6 lg:max-w-[70rem]">
        <RetentionBanner />
        <BillingUsageLimitBanner />
        <slot name="body" />
      </div>
    </template>
  </UDashboardPanel>
</template>
