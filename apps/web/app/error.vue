<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
  error: NuxtError
}>()

useSeoMeta({
  title: 'Page not found',
  description: 'We are sorry but this page could not be found.'
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp
    :toaster="{
      position: 'bottom-right',
      expand: false,
      duration: 5000,
      max: 5,
      progress: false
    }"
  >
    <UError :error="error" />
  </UApp>
</template>
