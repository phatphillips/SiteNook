<script setup lang="ts">
const props = defineProps<{
  status: 'warning' | 'exceeded'
  messages: string[]
  billingPath?: string
}>()

const title = computed(() =>
  props.status === 'exceeded'
    ? 'Plan usage limit reached'
    : 'Approaching plan usage limit'
)
</script>

<template>
  <UAlert
    :color="status === 'exceeded' ? 'error' : 'warning'"
    variant="subtle"
    :icon="status === 'exceeded' ? 'i-lucide-octagon-alert' : 'i-lucide-triangle-alert'"
    :title="title"
    class="shrink-0"
    :ui="{
      root: 'items-start gap-3',
      wrapper: 'min-w-0 flex-1',
      description: 'text-sm leading-relaxed'
    }"
  >
    <template #description>
      <p>{{ messages.join(' ') }}</p>
      <NuxtLink
        v-if="billingPath"
        :to="billingPath"
        class="mt-2 inline-block text-sm font-medium underline underline-offset-2"
      >
        Manage billing
      </NuxtLink>
    </template>
  </UAlert>
</template>
