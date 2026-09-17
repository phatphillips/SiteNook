import { describe, expect, it } from 'vitest'
import { normalizePublicPocketBaseUrl } from '../../../app/utils/normalizePublicPocketBaseUrl'

describe('normalizePublicPocketBaseUrl', () => {
  it('strips a mistaken /api suffix used for nginx', () => {
    expect(normalizePublicPocketBaseUrl('/api')).toBe('')
    expect(normalizePublicPocketBaseUrl('http://localhost/api')).toBe('http://localhost')
    expect(normalizePublicPocketBaseUrl('http://localhost/api/')).toBe('http://localhost')
  })

  it('leaves a normal origin alone', () => {
    expect(normalizePublicPocketBaseUrl('http://localhost')).toBe('http://localhost')
    expect(normalizePublicPocketBaseUrl('http://localhost:8090')).toBe('http://localhost:8090')
  })
})
