import type PocketBase from 'pocketbase'

declare module '#app' {
  interface NuxtApp {
    $pb: PocketBase | null
    $authReady: Promise<void>
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $pb: PocketBase | null
  }
}

export {}
