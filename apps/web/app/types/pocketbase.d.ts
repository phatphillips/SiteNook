import type PocketBase from 'pocketbase'

declare module '#app' {
  interface NuxtApp {
    $pb: PocketBase
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $pb: PocketBase
  }
}

export {}
