import type PocketBase from 'pocketbase'
import { ClientResponseError, type RecordModel } from 'pocketbase'
import { createSharedComposable } from '@vueuse/core'
import { getUserOrganizationId } from '~/utils/orgAccess'
import { parseTenantOnlyFlag, shouldEnforceTenantOnlyApex } from '~/utils/tenantOnlyApex'
import { isUserRecord, syncPbAuthState } from '~/utils/pbAuth'
import { resetAppSessionState } from '~/utils/sessionReset'

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ClientResponseError) {
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
  const nuxtApp = useNuxtApp()
  const pb = nuxtApp.$pb as PocketBase | null
  const user = useState<RecordModel | null>('pb-user', () => null)
  const isAuthenticated = useState('pb-authenticated', () => false)
  const authReady = useState('pb-auth-ready', () => false)

  function syncAuth() {
    if (!pb) return
    syncPbAuthState(pb, user, isAuthenticated)
  }

  async function awaitAuthReady() {
    if (import.meta.server) return
    if (authReady.value) return
    await nuxtApp.$authReady
  }

  function requireUser(): RecordModel {
    if (!pb) {
      throw new Error('Session expired. Please sign in again.')
    }
    syncAuth()
    const record = pb.authStore.record
    if (!pb.authStore.isValid || !isUserRecord(record)) {
      throw new Error('Session expired. Please sign in again.')
    }
    return record!
  }

  async function login(email: string, password: string) {
    if (!pb) throw new Error('Sign in is only available in the browser.')
    resetAppSessionState()
    pb.authStore.clear()
    user.value = null
    isAuthenticated.value = false
    const auth = await pb.collection('users').authWithPassword(email.trim(), password)

    const { organization, isTenantHost, isApexHost, loadTenantContext } = useTenantOrg()
    const config = useRuntimeConfig()
    try {
      await loadTenantContext(true)
    } catch {
      // Unknown tenant hosts surface via middleware; still block obvious org mismatches below.
    }

    if (
      shouldEnforceTenantOnlyApex(
        parseTenantOnlyFlag(config.public.tenantOnly),
        isApexHost.value,
        config.public.appDomain
      )
    ) {
      pb.authStore.clear()
      user.value = null
      isAuthenticated.value = false
      throw new Error('Sign in at your organization URL (e.g. your-org.' + config.public.appDomain + '/login).')
    }

    if (isTenantHost.value && organization.value?.id) {
      const userOrgId = getUserOrganizationId(auth.record)
      if (!userOrgId || userOrgId !== organization.value.id) {
        pb.authStore.clear()
        user.value = null
        isAuthenticated.value = false
        throw new Error('This account does not belong to this organization. Check your organization sign-in URL.')
      }
    }

    const userOrgId = getUserOrganizationId(auth.record)
    if (userOrgId) {
      await pb.collection('organizations').getOne(userOrgId, { fields: 'id,status,purge_scheduled_at,closed_at' })
    }

    syncAuth()
    return { record: auth.record, token: pb.authStore.token }
  }

  async function signup(name: string, email: string, password: string) {
    if (!pb) throw new Error('Sign up is only available in the browser.')
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

  async function requestPasswordReset(email: string) {
    if (!pb) throw new Error('Password reset is only available in the browser.')
    await pb.collection('users').requestPasswordReset(email.trim())
  }

  async function confirmPasswordReset(token: string, password: string) {
    if (!pb) throw new Error('Password reset is only available in the browser.')
    await pb.collection('users').confirmPasswordReset(token, password, password)
  }

  async function logout() {
    resetAppSessionState()
    if (pb) {
      pb.authStore.clear()
    }
    user.value = null
    isAuthenticated.value = false
    syncAuth()
    await navigateTo('/login', { replace: true })
  }

  function restoreAuth() {
    if (import.meta.server || !pb) return
    syncAuth()
  }

  function useRealtimeScan(scanId: Ref<string | undefined> | string | undefined) {
    const scan = ref<RecordModel | null>(null)

    if (import.meta.server || !pb) {
      return scan
    }

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

  // Read the synced Vue state — pb.authStore is not reactive, so a computed that
  // touches it directly will cache the first signed-in user until a full reload.
  const sessionUser = computed(() => (isAuthenticated.value ? user.value : null))

  return {
    pb,
    user,
    sessionUser,
    isAuthenticated,
    authReady,
    login,
    signup,
    requestPasswordReset,
    confirmPasswordReset,
    logout,
    restoreAuth,
    awaitAuthReady,
    requireUser,
    syncAuth,
    useRealtimeScan,
    getAuthErrorMessage
  }
}

export const usePocketBase = createSharedComposable(_usePocketBase)
