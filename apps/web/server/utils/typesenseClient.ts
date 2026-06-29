import Typesense from 'typesense'
import {
  isTypesenseEnabled,
  parseTypesenseUrl,
  SEARCH_COLLECTION
} from './typesenseConfig'

let client: Typesense.Client | null = null

export function getTypesenseClient(): Typesense.Client | null {
  if (!isTypesenseEnabled()) return null
  if (!client) {
    const node = parseTypesenseUrl(process.env.TYPESENSE_URL!)
    client = new Typesense.Client({
      nodes: [node],
      apiKey: process.env.TYPESENSE_API_KEY!,
      connectionTimeoutSeconds: 10
    })
  }
  return client
}

export { SEARCH_COLLECTION }
