/**
 * Fetch text from a Nitro API route using the PocketBase session token.
 */
export async function fetchAuthedText(url: string, token?: string): Promise<string> {
  const { pb } = usePocketBase()
  const authToken = token ?? pb?.authStore.token
  const headers: HeadersInit = authToken && url.startsWith('/api/')
    ? { Authorization: `Bearer ${authToken}` }
    : {}

  const response = await fetch(url, { headers })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || response.statusText || `Request failed (${response.status})`)
  }
  return response.text()
}
