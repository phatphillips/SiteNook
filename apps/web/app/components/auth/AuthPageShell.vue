<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  icon?: string
}>()
</script>

<template>
  <div class="auth-page min-h-screen flex items-center justify-center p-4 sm:p-6">
    <UCard
      class="auth-page-card w-full max-w-md"
      :ui="{
        root: 'ring ring-default border border-default bg-elevated/50 backdrop-blur-sm',
        header: 'border-b border-default/60 pb-0',
        body: 'pt-6'
      }"
    >
      <template #header>
        <div class="auth-page-header text-center py-2">
          <div class="auth-page-icon mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <UIcon :name="icon ?? 'i-lucide-search-check'" class="size-7 text-primary" />
          </div>
          <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
            {{ title }}
          </h1>
          <p v-if="subtitle" class="mt-1.5 text-sm text-muted leading-relaxed">
            {{ subtitle }}
          </p>
        </div>
      </template>

      <slot />
    </UCard>
  </div>
</template>
