// https://nuxt.com/docs/api/configuration/nuxt-config

const pocketbaseUrl = process.env.NUXT_PUBLIC_POCKETBASE_URL?.trim()
const isProductionNuxtBuild = process.env.NODE_ENV === 'production'
  && process.env.npm_lifecycle_event === 'build'

if (isProductionNuxtBuild && !pocketbaseUrl) {
  throw new Error(
    'NUXT_PUBLIC_POCKETBASE_URL must be set for production builds. '
    + 'Example: NUXT_PUBLIC_POCKETBASE_URL=/api'
  )
}

const isDev = process.env.NODE_ENV !== 'production'

const stripeCheckoutConfigured = Boolean(
  process.env.NUXT_STRIPE_SECRET_KEY?.trim()
  && (
    process.env.NUXT_STRIPE_TEAM_PRICE_ID?.trim()?.startsWith('price_')
    || process.env.NUXT_STRIPE_STANDARD_PRICE_ID?.trim()?.startsWith('price_')
  )
)

const stripeAnnualCheckoutConfigured = Boolean(
  process.env.NUXT_STRIPE_SECRET_KEY?.trim()
  && process.env.NUXT_STRIPE_TEAM_ANNUAL_PRICE_ID?.trim()?.startsWith('price_')
)

/** Dashboard routes — client-only so auth guards run where PocketBase session exists. */
const protectedAppRoutes = {
  '/sites/**': { ssr: false },
  '/search/**': { ssr: false },
  '/settings/**': { ssr: false },
  '/scans/**': { ssr: false },
  '/policies/**': { ssr: false }
} as const

/** Public/marketing routes — CSR in dev avoids Nuxt SSR deadlock in Docker (internal fetch + vite-node). */
const devClientOnlyPublicRoutes = isDev
  ? {
      '/': { ssr: false },
      '/pricing': { ssr: false },
      '/find-account': { ssr: false },
      '/sign-in': { ssr: false },
      '/signup': { ssr: false },
      '/start': { ssr: false },
      '/login': { ssr: false },
      '/forgot-password': { ssr: false },
      '/reset-password': { ssr: false },
      '/account-not-found': { ssr: false },
      '/account-closed': { ssr: false }
    } as const
  : {}

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  runtimeConfig: {
    pocketbaseUrl: process.env.NUXT_POCKETBASE_URL || '',
    pbAdminEmail: process.env.NUXT_PB_ADMIN_EMAIL || '',
    pbAdminPassword: process.env.NUXT_PB_ADMIN_PASSWORD || '',
    provisionApiKey: process.env.NUXT_PROVISION_API_KEY || '',
    turnstileSecret: process.env.NUXT_TURNSTILE_SECRET || '',
    stripeSecretKey: process.env.NUXT_STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET || '',
    stripeStarterPriceId: process.env.NUXT_STRIPE_STARTER_PRICE_ID || '',
    stripeTeamPriceId: process.env.NUXT_STRIPE_TEAM_PRICE_ID || '',
    stripeBusinessPriceId: process.env.NUXT_STRIPE_BUSINESS_PRICE_ID || '',
    stripeStandardPriceId: process.env.NUXT_STRIPE_STANDARD_PRICE_ID || '',
    stripeStarterAnnualPriceId: process.env.NUXT_STRIPE_STARTER_ANNUAL_PRICE_ID || '',
    stripeTeamAnnualPriceId: process.env.NUXT_STRIPE_TEAM_ANNUAL_PRICE_ID || '',
    stripeBusinessAnnualPriceId: process.env.NUXT_STRIPE_BUSINESS_ANNUAL_PRICE_ID || '',
    stripeStarterPriceIdAud: process.env.NUXT_STRIPE_STARTER_PRICE_ID_AUD || '',
    stripeTeamPriceIdAud: process.env.NUXT_STRIPE_TEAM_PRICE_ID_AUD || '',
    stripeBusinessPriceIdAud: process.env.NUXT_STRIPE_BUSINESS_PRICE_ID_AUD || '',
    stripeStarterAnnualPriceIdAud: process.env.NUXT_STRIPE_STARTER_ANNUAL_PRICE_ID_AUD || '',
    stripeTeamAnnualPriceIdAud: process.env.NUXT_STRIPE_TEAM_ANNUAL_PRICE_ID_AUD || '',
    stripeBusinessAnnualPriceIdAud: process.env.NUXT_STRIPE_BUSINESS_ANNUAL_PRICE_ID_AUD || '',
    stripeDevBypassToken: process.env.NUXT_STRIPE_DEV_BYPASS_TOKEN || '',
    licenceSigningSecret: process.env.NUXT_LICENCE_SIGNING_SECRET || '',
    licenceAdminKey: process.env.NUXT_LICENCE_ADMIN_KEY || '',
    public: {
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || 'contact@your-org.com',
      pocketbaseUrl: pocketbaseUrl || 'http://localhost:8090',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      appDomain: process.env.NUXT_PUBLIC_APP_DOMAIN || 'localhost',
      tenantOnly: process.env.NUXT_PUBLIC_TENANT_ONLY || 'false',
      marketingSite: process.env.NUXT_PUBLIC_MARKETING_SITE || 'false',
      selfServiceSignup: process.env.NUXT_PUBLIC_SELF_SERVICE_SIGNUP || 'false',
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
      termsUrl: process.env.NUXT_PUBLIC_TERMS_URL || '',
      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
      stripeCheckoutConfigured: stripeCheckoutConfigured ? 'true' : 'false',
      stripeAnnualCheckoutConfigured: stripeAnnualCheckoutConfigured ? 'true' : 'false',
      stripeDevBypass: process.env.NUXT_PUBLIC_STRIPE_DEV_BYPASS || 'false',
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
    },
    {
      path: '~/components/scans',
      pathPrefix: false
    },
    {
      path: '~/components/sites',
      pathPrefix: false
    },
    {
      path: '~/components/settings',
      pathPrefix: false
    },
    {
      path: '~/components/auth',
      pathPrefix: false
    },
    {
      path: '~/components/marketing',
      pathPrefix: false
    },
    {
      path: '~/components/search',
      pathPrefix: false
    }
  ],

  routeRules: {
    '/api/**': {
      cors: true
    },
    '/dashboard': { redirect: '/' },
    ...protectedAppRoutes,
    ...devClientOnlyPublicRoutes
  },

  compatibilityDate: '2024-07-11',

  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 512
    },
    serverBundle: {
      collections: ['lucide', 'simple-icons']
    }
  },

  vite: {
    optimizeDeps: {
      include: ['pocketbase']
    },
    server: {
      hmr: {
        // Docker dev: browser connects on published port 3000, not Vite's internal 5173
        clientPort: Number(process.env.NUXT_DEV_HMR_CLIENT_PORT || 3000)
      }
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
