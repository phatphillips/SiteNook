/**
 * Download a file from a Nitro API route using the PocketBase session token.
 */
export async function downloadAuthed(
  url: string,
  filename: string,
  init?: RequestInit
): Promise<void> {
  const { pb } = usePocketBase()
  const token = pb?.authStore.token
  const headers = new Headers(init?.headers)
  if (token && url.startsWith('/api/') && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...init, headers })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}
