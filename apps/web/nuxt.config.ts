// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  runtimeConfig: {
    public: {
      pocketbaseUrl: process.env.NUXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      maxPagesPerScan: Number(process.env.NUXT_PUBLIC_MAX_PAGES || process.env.MAX_PAGES || 500)
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  components: [
    '~/components',
    {
      path: '~/components/shared',
      pathPrefix: false
    }
  ],

  routeRules: {
    '/api/**': {
      cors: true
    },
    '/dashboard': { redirect: '/' }
  },

  compatibilityDate: '2024-07-11',

  vite: {
    optimizeDeps: {
      include: [
        'pocketbase',
        '@vue/devtools-core',
        '@vue/devtools-kit'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
