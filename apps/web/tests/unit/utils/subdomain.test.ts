import { describe, expect, it } from 'vitest'
import { parseHostSubdomain } from '~/utils/subdomain'

describe('parseHostSubdomain', () => {
  it('treats apex production hosts as non-tenant', () => {
    expect(parseHostSubdomain('sitenook.com', 'sitenook.com')).toEqual({
      host: 'sitenook.com',
      subdomain: null,
      isApex: true
    })
    expect(parseHostSubdomain('www.sitenook.com', 'sitenook.com')).toEqual({
      host: 'www.sitenook.com',
      subdomain: null,
      isApex: true
    })
  })

  it('extracts tenant subdomains from production hosts', () => {
    expect(parseHostSubdomain('agency.sitenook.com', 'sitenook.com')).toEqual({
      host: 'agency.sitenook.com',
      subdomain: 'agency',
      isApex: false
    })
  })

  it('supports subdomain.localhost for local dev', () => {
    expect(parseHostSubdomain('default.localhost:3000', 'localhost')).toEqual({
      host: 'default.localhost',
      subdomain: 'default',
      isApex: false
    })
    expect(parseHostSubdomain('localhost:3000', 'localhost')).toEqual({
      host: 'localhost',
      subdomain: null,
      isApex: true
    })
  })

  it('ignores reserved infrastructure subdomains', () => {
    expect(parseHostSubdomain('www.sitenook.com', 'sitenook.com').isApex).toBe(true)
    expect(parseHostSubdomain('api.sitenook.com', 'sitenook.com').isApex).toBe(true)
  })
})
