<script setup lang="ts">
withDefaults(defineProps<{
  /** Page heading under the brand wordmark. Omit when the logo alone is enough. */
  title?: string
  subtitle?: string
  /** Optional icon above the title (hidden when brand wordmark is shown). */
  icon?: string
  /** Show the SiteNook text logo in the card header. */
  brand?: boolean
}>(), {
  brand: true
})
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
          <div
            v-if="brand"
            class="auth-page-brand mb-4 flex justify-center overflow-visible"
          >
            <SiteNookLogo size="lg" />
            <span class="sr-only">SiteNook</span>
          </div>
          <div
            v-else-if="icon"
            class="auth-page-icon mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20"
          >
            <UIcon :name="icon" class="size-7 text-primary" />
          </div>
          <h1
            v-if="title"
            class="text-2xl font-semibold tracking-tight text-highlighted"
            :class="brand ? 'text-xl' : undefined"
          >
            {{ title }}
          </h1>
          <p
            v-if="subtitle"
            class="text-sm text-muted leading-relaxed"
            :class="title ? 'mt-1.5' : 'mt-0.5'"
          >
            {{ subtitle }}
          </p>
        </div>
      </template>

      <slot />
    </UCard>
  </div>
</template>
