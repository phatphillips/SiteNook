import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { isUserRecord, resolveLoginRedirectPath, syncPbAuthState } from '~/utils/pbAuth'

describe('resolveLoginRedirectPath', () => {
  it('returns fallback for missing or invalid values', () => {
    expect(resolveLoginRedirectPath(undefined)).toBe('/')
    expect(resolveLoginRedirectPath(null)).toBe('/')
    expect(resolveLoginRedirectPath('')).toBe('/')
    expect(resolveLoginRedirectPath('https://evil.test')).toBe('/')
    expect(resolveLoginRedirectPath('//evil.test/path')).toBe('/')
  })

  it('returns safe in-app paths', () => {
    expect(resolveLoginRedirectPath('/sites/abc')).toBe('/sites/abc')
    expect(resolveLoginRedirectPath('/sites/abc?tab=issues')).toBe('/sites/abc?tab=issues')
    expect(resolveLoginRedirectPath('  /scans  ')).toBe('/scans')
  })

  it('uses custom fallback', () => {
    expect(resolveLoginRedirectPath(undefined, '/dashboard')).toBe('/dashboard')
  })
})

describe('syncPbAuthState', () => {
  it('updates reactive auth refs when the signed-in user changes', () => {
    const user = ref<{ id: string, name: string, collectionName: string } | null>(null)
    const isAuthenticated = ref(false)
    const pb = {
      authStore: {
        isValid: true,
        record: { id: 'donkey', name: 'Donkey', collectionName: 'users' }
      }
    }

    syncPbAuthState(pb as never, user, isAuthenticated)
    expect(isAuthenticated.value).toBe(true)
    expect(user.value?.name).toBe('Donkey')

    pb.authStore.record = { id: 'minimojo', name: 'minimojo089', collectionName: 'users' }
    syncPbAuthState(pb as never, user, isAuthenticated)
    expect(user.value?.name).toBe('minimojo089')
    expect(user.value?.id).toBe('minimojo')
  })

  it('clears reactive auth refs when the session is invalid', () => {
    const user = ref({ id: 'donkey', name: 'Donkey', collectionName: 'users' })
    const isAuthenticated = ref(true)
    const pb = {
      authStore: {
        isValid: false,
        record: null
      }
    }

    syncPbAuthState(pb as never, user, isAuthenticated)
    expect(isAuthenticated.value).toBe(false)
    expect(user.value).toBeNull()
  })
})

describe('isUserRecord', () => {
  it('accepts users collection records', () => {
    expect(isUserRecord({ collectionName: 'users' } as never)).toBe(true)
    expect(isUserRecord({ collectionId: '_pb_users_auth_' } as never)).toBe(true)
    expect(isUserRecord(null)).toBe(false)
  })
})
