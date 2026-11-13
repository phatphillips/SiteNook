<script setup lang="ts">
usePrimaryColor()

const colorMode = useColorMode()

const color = computed(() => themeColorMeta(colorMode.value))

/** Kumo-style stacked toasts: collapse into a pile, expand on hover. */
const toaster = {
  position: 'bottom-right' as const,
  expand: false,
  duration: 5000,
  max: 5,
  progress: false
}

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/brand/sitenook-mark.svg' },
    { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'SiteNook'
const description = 'Hosted cloud web accessibility and QA monitoring platform.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/dashboard-light.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp :toaster="toaster">
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
