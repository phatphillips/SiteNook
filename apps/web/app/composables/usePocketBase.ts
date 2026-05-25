import type PocketBase from 'pocketbase'
import PocketBaseLib, { type RecordModel } from 'pocketbase'
import { createSharedComposable } from '@vueuse/core'

function isUserRecord(record: RecordModel | null | undefined) {
  return !!record && (record.collectionName === 'users' || record.collectionId === '_pb_users_auth_')
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof PocketBaseLib.ClientResponseError) {
    if (error.status === 400 || error.status === 401) {
      return 'Invalid email or password. Please try again.'
    }
    return error.message || 'Sign in failed.'
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'Sign in failed.'
}

const _usePocketBase = () => {
  const pb = useNuxtApp().$pb as PocketBase
  const user = useState<RecordModel | null>('pb-user', () => null)
  const isAuthenticated = useState('pb-authenticated', () => false)

  function syncAuth() {
    const record = pb.authStore.record
    const authed = pb.authStore.isValid && isUserRecord(record)
    isAuthenticated.value = authed
    user.value = authed ? record! : null
  }

  function requireUser(): RecordModel {
    syncAuth()
    const record = pb.authStore.record
    if (!pb.authStore.isValid || !isUserRecord(record)) {
      throw new Error('Session expired. Please sign in again.')
    }
    return record!
  }

  async function login(email: string, password: string) {
    await pb.collection('users').authWithPassword(email.trim(), password)
    syncAuth()
    return { record: user.value!, token: pb.authStore.token }
  }

  async function signup(name: string, email: string, password: string) {
    const payload: Record<string, unknown> = {
      email: email.trim(),
      password,
      passwordConfirm: password,
      name: name.trim(),
      emailVisibility: true
    }

    await pb.collection('users').create(payload)
    return login(email, password)
  }

  async function logout() {
    pb.authStore.clear()
    user.value = null
    isAuthenticated.value = false
    await navigateTo('/login')
  }

  function restoreAuth() {
    if (import.meta.server) return
    syncAuth()
  }

  function useRealtimeScan(scanId: Ref<string | undefined> | string | undefined) {
    const scan = ref<RecordModel | null>(null)

    let unsubscribe: (() => void) | null = null

    watch(
      () => (typeof scanId === 'object' ? scanId.value : scanId),
      async (id) => {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
        if (!id) {
          scan.value = null
          return
        }

        try {
          scan.value = await pb.collection('scans').getOne(id)
        } catch {
          scan.value = null
        }

        unsubscribe = await pb.collection('scans').subscribe(id, (e) => {
          scan.value = e.record
        })
      },
      { immediate: true }
    )

    onUnmounted(() => {
      if (unsubscribe) unsubscribe()
    })

    return scan
  }

  return {
    pb,
    user,
    isAuthenticated,
    login,
    signup,
    logout,
    restoreAuth,
    requireUser,
    syncAuth,
    useRealtimeScan,
    getAuthErrorMessage
  }
}

export const usePocketBase = createSharedComposable(_usePocketBase)
