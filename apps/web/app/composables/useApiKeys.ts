export type ApiKeyScope = 'read' | 'write'

export interface ApiKeyPublicMeta {
  id: string
  name: string
  key_prefix: string
  scopes: ApiKeyScope[]
  created_by?: string
  last_used_at?: string | null
  revoked_at?: string | null
  created?: string
  updated?: string
}

export function useApiKeys() {
  const { pb } = usePocketBase()
  const keys = ref<ApiKeyPublicMeta[]>([])
  const loading = ref(false)
  const creating = ref(false)

  function authHeaders(): HeadersInit {
    const token = pb?.authStore.token
    if (!token) throw new Error('Not authenticated')
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  }

  async function fetchKeys() {
    loading.value = true
    try {
      const data = await $fetch<{ items: ApiKeyPublicMeta[] }>('/api/agent/keys', {
        headers: authHeaders()
      })
      keys.value = data.items || []
    } finally {
      loading.value = false
    }
  }

  async function createKey(name: string, scopes: ApiKeyScope[] = ['read', 'write']) {
    creating.value = true
    try {
      const data = await $fetch<{ key: string, item: ApiKeyPublicMeta }>('/api/agent/keys', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: { name, scopes }
      })
      await fetchKeys()
      return data
    } finally {
      creating.value = false
    }
  }

  async function revokeKey(id: string) {
    await $fetch(`/api/agent/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    await fetchKeys()
  }

  return {
    keys,
    loading,
    creating,
    fetchKeys,
    createKey,
    revokeKey
  }
}
