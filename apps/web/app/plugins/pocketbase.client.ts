import PocketBase, { type RecordModel } from 'pocketbase'

function isUserRecord(record: RecordModel | null | undefined) {
  return !!record && (record.collectionName === 'users' || record.collectionId === '_pb_users_auth_')
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const pb = new PocketBase(config.public.pocketbaseUrl)
  pb.autoCancellation(false)

  nuxtApp.provide('pb', pb)

  const user = useState<RecordModel | null>('pb-user', () => null)
  const isAuthenticated = useState('pb-authenticated', () => false)

  function syncAuth() {
    const record = pb.authStore.record
    const authed = pb.authStore.isValid && isUserRecord(record)
    isAuthenticated.value = authed
    user.value = authed ? record! : null
  }

  if (import.meta.client) {
    pb.authStore.onChange(syncAuth, true)

    if (pb.authStore.isValid) {
      pb.collection('users').authRefresh().catch(() => {
        pb.authStore.clear()
        syncAuth()
      })
    }
  }
})
