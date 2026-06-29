import { describe, expect, it } from 'vitest'
import { parseHostSubdomain } from '~/utils/subdomain'

describe('parseHostSubdomain', () => {
  it('treats apex production hosts as non-tenant', () => {
    expect(parseHostSubdomain('accessiq.com', 'accessiq.com')).toEqual({
      host: 'accessiq.com',
      subdomain: null,
      isApex: true
    })
    expect(parseHostSubdomain('www.accessiq.com', 'accessiq.com')).toEqual({
      host: 'www.accessiq.com',
      subdomain: null,
      isApex: true
    })
  })

  it('extracts tenant subdomains from production hosts', () => {
    expect(parseHostSubdomain('agency.accessiq.com', 'accessiq.com')).toEqual({
      host: 'agency.accessiq.com',
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
    expect(parseHostSubdomain('www.accessiq.com', 'accessiq.com').isApex).toBe(true)
    expect(parseHostSubdomain('api.accessiq.com', 'accessiq.com').isApex).toBe(true)
  })
})
