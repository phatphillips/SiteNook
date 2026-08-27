import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../server/utils/typesenseClient', () => ({
  getTypesenseClient: vi.fn(() => null)
}))

vi.mock('../../../server/utils/helpFs', () => ({
  loadAllHelpArticles: vi.fn(async () => [])
}))

describe('helpTypesense search', () => {
  const originalEnabled = process.env.TYPESENSE_ENABLED
  const originalUrl = process.env.TYPESENSE_URL
  const originalKey = process.env.TYPESENSE_API_KEY

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.TYPESENSE_ENABLED = originalEnabled
    process.env.TYPESENSE_URL = originalUrl
    process.env.TYPESENSE_API_KEY = originalKey
  })

  it('returns empty hits for blank queries without calling Typesense', async () => {
    process.env.TYPESENSE_ENABLED = '1'
    process.env.TYPESENSE_URL = 'http://localhost:8108'
    process.env.TYPESENSE_API_KEY = 'test-key'

    const { searchHelpArticles, resetHelpTypesenseForTests } = await import(
      '../../../server/utils/helpTypesense'
    )
    resetHelpTypesenseForTests()

    await expect(searchHelpArticles('')).resolves.toEqual({ hits: [], found: 0 })
    await expect(searchHelpArticles('   ')).resolves.toEqual({ hits: [], found: 0 })
  })

  it('throws unavailable when Typesense is disabled', async () => {
    process.env.TYPESENSE_ENABLED = '0'
    delete process.env.TYPESENSE_URL
    delete process.env.TYPESENSE_API_KEY

    const { searchHelpArticles, resetHelpTypesenseForTests } = await import(
      '../../../server/utils/helpTypesense'
    )
    const { TypesenseUnavailableError } = await import(
      '../../../server/utils/typesenseConfig'
    )
    resetHelpTypesenseForTests()

    await expect(searchHelpArticles('scan')).rejects.toBeInstanceOf(TypesenseUnavailableError)
  })
})
