export const SEARCH_COLLECTION = 'search_documents'
export const BODY_MAX_CHARS = 200_000

export function isTypesenseEnabled(): boolean {
  return process.env.TYPESENSE_ENABLED === '1'
    && Boolean(process.env.TYPESENSE_URL?.trim())
    && Boolean(process.env.TYPESENSE_API_KEY?.trim())
}

export function parseTypesenseUrl(url: string): {
  host: string
  port: number
  protocol: 'http' | 'https'
} {
  const parsed = new URL(url)
  const protocol = parsed.protocol === 'https:' ? 'https' : 'http'
  const defaultPort = protocol === 'https' ? 443 : 80
  const port = parsed.port ? Number(parsed.port) : defaultPort
  return { host: parsed.hostname, port, protocol }
}
