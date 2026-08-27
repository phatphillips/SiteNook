<script setup lang="ts">
withDefaults(defineProps<{
  headline: string
  description: string
  ctaLabel: string
  ctaTo: string
  eyebrow?: string
  /** stack = text above product; split = text 1/3 left; split-reverse = product left, text right */
  layout?: 'stack' | 'split' | 'split-reverse'
}>(), {
  layout: 'stack'
})
</script>

<template>
  <div
    class="marketing-feature-showcase"
    :class="{
      'space-y-8': layout === 'stack',
      'grid items-center gap-10 lg:grid-cols-3 lg:gap-12': layout !== 'stack'
    }"
  >
    <div
      class="marketing-feature-copy"
      :class="{
        'max-w-2xl': layout === 'stack',
        'lg:col-span-1': layout !== 'stack',
        'lg:order-2': layout === 'split-reverse'
      }"
    >
      <p
        v-if="eyebrow"
        class="mb-3 text-sm font-medium text-primary"
      >
        {{ eyebrow }}
      </p>
      <h3 class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
        {{ headline }}
      </h3>
      <p class="mt-4 text-base leading-relaxed text-muted">
        {{ description }}
      </p>
      <NuxtLink
        :to="ctaTo"
        class="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {{ ctaLabel }}
        <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </div>

    <div
      class="marketing-showcase-frame min-w-0"
      :class="{
        'lg:col-span-2': layout !== 'stack',
        'lg:order-1': layout === 'split-reverse'
      }"
    >
      <div
        class="marketing-showcase-scale"
        :class="{
          'marketing-showcase-scale--center': layout === 'stack',
          'marketing-showcase-scale--left': layout === 'split-reverse',
          'marketing-showcase-scale--right': layout === 'split'
        }"
      >
        <slot name="product" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.marketing-showcase-frame {
  animation: marketing-frame-rise 0.7s ease-out both;
}

/* Shrink product windows to 75% while copy stays full size. Prefer zoom so layout space collapses. */
.marketing-showcase-scale {
  width: 100%;
  zoom: 0.75;
}

@supports not (zoom: 1) {
  .marketing-showcase-scale {
    width: calc(100% / 0.75);
    transform: scale(0.75);
  }

  .marketing-showcase-scale--center {
    transform-origin: top center;
    margin-inline: auto;
  }

  .marketing-showcase-scale--left {
    transform-origin: top left;
  }

  .marketing-showcase-scale--right {
    transform-origin: top right;
    margin-left: calc(100% - (100% / 0.75));
  }
}

@keyframes marketing-frame-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .marketing-showcase-frame {
    animation: none;
  }
}
</style>
