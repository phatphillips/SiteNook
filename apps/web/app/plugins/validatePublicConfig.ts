export default defineNuxtPlugin(() => {
  if (!import.meta.client || !import.meta.env.PROD) return

  const config = useRuntimeConfig()
  const pbUrl = String(config.public.pocketbaseUrl || '').trim()
  if (!pbUrl) {
    throw new Error(
      'NUXT_PUBLIC_POCKETBASE_URL is missing. Set it in the environment before running a production build.'
    )
  }
})
