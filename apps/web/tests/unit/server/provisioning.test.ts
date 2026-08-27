import { describe, it, expect, vi } from 'vitest'
import type PocketBase from 'pocketbase'
import { ClientResponseError } from 'pocketbase'
import {
  buildTenantAppOrigin,
  buildTenantLoginUrl,
  provisionOrganization,
  resolveProvisionPlan,
  validateOrgName,
  validateOwnerEmail,
  validateOwnerName,
  validateProvisionInput,
  validateProvisionPlan,
  validateSubdomain
} from '../../../server/utils/provisioning'

describe('provisioning validation', () => {
  it('accepts valid organization input', () => {
    expect(validateProvisionInput({
      orgName: 'Acme Agency',
      subdomain: 'acme',
      ownerName: 'Jane Owner',
      ownerEmail: 'jane@acme.test'
    })).toBeNull()
  })

  it('rejects reserved subdomains', () => {
    expect(validateSubdomain('www')).toMatch(/reserved/i)
  })

  it('rejects invalid subdomains', () => {
    expect(validateSubdomain('a')).toMatch(/2–63/)
    expect(validateSubdomain('-acme')).toMatch(/hyphen/)
    expect(validateSubdomain('acme_agency')).toMatch(/lowercase|letters/)
  })

  it('rejects missing fields', () => {
    expect(validateOrgName('')).toMatch(/required/)
    expect(validateOwnerName('')).toMatch(/required/)
    expect(validateOwnerEmail('not-an-email')).toMatch(/not valid/)
  })

  it('rejects invalid plan slugs', () => {
    expect(validateProvisionPlan('pro')).toMatch(/starter, team, business, or enterprise/)
    expect(validateProvisionPlan('team')).toBeNull()
  })
})

describe('resolveProvisionPlan', () => {
  const baseInput = {
    orgName: 'Acme',
    subdomain: 'acme',
    ownerName: 'Jane',
    ownerEmail: 'jane@acme.test'
  }

  it('uses explicit plan when provided', () => {
    expect(resolveProvisionPlan({ ...baseInput, plan: 'standard' }, 'self_service')).toBe('team')
    expect(resolveProvisionPlan({ ...baseInput, plan: 'free' }, 'provision_api')).toBe('free')
  })

  it('defaults self-service to free and provision API to team', () => {
    expect(resolveProvisionPlan(baseInput, 'self_service')).toBe('free')
    expect(resolveProvisionPlan(baseInput, 'provision_api')).toBe('team')
  })
})

describe('buildTenantLoginUrl', () => {
  it('builds localhost tenant URLs with port', () => {
    expect(buildTenantLoginUrl('acme', 'localhost', 'http://localhost:3000'))
      .toBe('http://acme.localhost:3000/login')
  })

  it('builds production tenant URLs', () => {
    expect(buildTenantLoginUrl('acme', 'sitenook.com', 'https://sitenook.com'))
      .toBe('https://acme.sitenook.com/login')
  })

  it('builds tenant app origin without login path', () => {
    expect(buildTenantAppOrigin('acme', 'localhost', 'http://localhost:3000'))
      .toBe('http://acme.localhost:3000')
  })
})

describe('provisionOrganization', () => {
  it('creates the owner with verified false until password is set', async () => {
    const userCreate = vi.fn().mockResolvedValue({
      id: 'user1',
      email: 'jane@acme.test',
      name: 'Jane Owner'
    })
    const orgCreate = vi.fn().mockResolvedValue({
      id: 'org1',
      name: 'Acme Agency',
      subdomain: 'acme'
    })
    const requestPasswordReset = vi.fn().mockResolvedValue(undefined)

    const pb = {
      collection: (name: string) => {
        if (name === 'organizations') {
          return {
            create: orgCreate,
            delete: vi.fn().mockResolvedValue(undefined),
            getFirstListItem: vi.fn().mockRejectedValue(new ClientResponseError({ status: 404 } as never))
          }
        }
        if (name === 'users') {
          return {
            create: userCreate,
            requestPasswordReset
          }
        }
        throw new Error(`Unexpected collection: ${name}`)
      }
    } as unknown as PocketBase

    await provisionOrganization(
      pb,
      {
        orgName: 'Acme Agency',
        subdomain: 'acme',
        ownerName: 'Jane Owner',
        ownerEmail: 'jane@acme.test'
      },
      {
        appDomain: 'localhost',
        appUrl: 'http://localhost:3000',
        createdVia: 'provision_api'
      }
    )

    expect(userCreate).toHaveBeenCalledWith(expect.objectContaining({ verified: false }))
    expect(orgCreate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      subscription_status: 'none'
    }))
    expect(requestPasswordReset).toHaveBeenCalledWith('jane@acme.test')
  })
})
