import { ClientResponseError } from 'pocketbase'

/** Turn PocketBase SDK errors into a short message for the UI. */
export function formatPbClientError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const responseData = error.response as {
      message?: string
      data?: Record<string, { message?: string }>
    } | undefined

    const fieldMessages = responseData?.data
      ? Object.values(responseData.data)
        .map(field => field?.message)
        .filter((message): message is string => Boolean(message))
      : []

    if (fieldMessages.length) {
      return fieldMessages.join(' ')
    }

    if (responseData?.message) {
      return responseData.message
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

/** Nitro API / $fetch errors and PocketBase client errors. */
export function formatRequestError(error: unknown, fallback = 'Request failed'): string {
  if (error && typeof error === 'object') {
    const candidate = error as {
      data?: { statusMessage?: string, message?: string }
      statusMessage?: string
      message?: string
    }
    if (candidate.data?.statusMessage && !isGenericHttpMessage(candidate.data.statusMessage)) {
      return candidate.data.statusMessage
    }
    if (candidate.statusMessage && !isGenericHttpMessage(candidate.statusMessage)) {
      return candidate.statusMessage
    }
    if (candidate.data?.message && !isGenericHttpMessage(candidate.data.message)) {
      return candidate.data.message
    }
  }

  if (error instanceof Error && /^\[(?:GET|POST|PUT|PATCH|DELETE)\]/i.test(error.message)) {
    return fallback
  }

  const pbMessage = formatPbClientError(error)
  if (pbMessage !== 'Request failed' && !isGenericHttpMessage(pbMessage)) {
    return pbMessage
  }

  if (error instanceof Error && error.message && !isGenericHttpMessage(error.message)) {
    return error.message
  }

  return fallback
}

function isGenericHttpMessage(message: string | undefined): boolean {
  if (!message?.trim()) return true
  return /^Server Error$/i.test(message.trim())
    || /^\d{3}\s+Server Error$/i.test(message.trim())
}
