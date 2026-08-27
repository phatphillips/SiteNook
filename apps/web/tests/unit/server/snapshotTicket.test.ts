import { describe, expect, it, vi } from 'vitest'
import {
  SNAPSHOT_TICKET_TTL_MS,
  assertSnapshotTicketMatches,
  signSnapshotTicket,
  verifySnapshotTicket
} from '../../../server/utils/snapshotTicket'

vi.stubGlobal('useRuntimeConfig', () => ({
  previewSigningSecret: process.env.NUXT_PREVIEW_SIGNING_SECRET || '',
  licenceSigningSecret: process.env.NUXT_LICENCE_SIGNING_SECRET || '',
  pbAdminPassword: process.env.NUXT_PB_ADMIN_PASSWORD || ''
}))

function withPreviewSecret<T>(fn: () => T): T {
  const previousPreview = process.env.NUXT_PREVIEW_SIGNING_SECRET
  const previousLicence = process.env.NUXT_LICENCE_SIGNING_SECRET
  process.env.NUXT_PREVIEW_SIGNING_SECRET = 'test-preview-signing-secret'
  delete process.env.NUXT_LICENCE_SIGNING_SECRET
  try {
    return fn()
  } finally {
    if (previousPreview === undefined) delete process.env.NUXT_PREVIEW_SIGNING_SECRET
    else process.env.NUXT_PREVIEW_SIGNING_SECRET = previousPreview
    if (previousLicence === undefined) delete process.env.NUXT_LICENCE_SIGNING_SECRET
    else process.env.NUXT_LICENCE_SIGNING_SECRET = previousLicence
  }
}

describe('snapshotTicket', () => {
  it('signs and verifies a ticket for the issuing user and page', () => {
    withPreviewSecret(() => {
      const ticket = signSnapshotTicket({
        uid: 'user-1',
        siteId: 'site-1',
        pageId: 'page-1'
      })
      const payload = verifySnapshotTicket(ticket)
      expect(payload.uid).toBe('user-1')
      expect(payload.siteId).toBe('site-1')
      expect(payload.pageId).toBe('page-1')
    })
  })

  it('rejects an expired ticket', () => {
    withPreviewSecret(() => {
      const ticket = signSnapshotTicket(
        { uid: 'user-1', siteId: 'site-1', pageId: 'page-1' },
        undefined,
        Date.now() - SNAPSHOT_TICKET_TTL_MS - 1000
      )
      expect(() => verifySnapshotTicket(ticket)).toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })
  })

  it('rejects a ticket used on a different site or page', () => {
    withPreviewSecret(() => {
      const payload = verifySnapshotTicket(signSnapshotTicket({
        uid: 'user-1',
        siteId: 'site-1',
        pageId: 'page-1'
      }))
      expect(() => assertSnapshotTicketMatches(payload, 'other-site', 'page-1')).toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
      expect(() => assertSnapshotTicketMatches(payload, 'site-1', 'other-page')).toThrowError(
        expect.objectContaining({ statusCode: 403 })
      )
    })
  })

  it('rejects a ticket whose user id was tampered with', () => {
    withPreviewSecret(() => {
      const ticket = signSnapshotTicket({
        uid: 'user-1',
        siteId: 'site-1',
        pageId: 'page-1'
      })
      const [body] = ticket.split('.')
      const parsed = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as {
        uid: string
        siteId: string
        pageId: string
        exp: number
      }
      parsed.uid = 'user-2'
      const tampered = `${Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64url')}.${ticket.split('.')[1]}`
      expect(() => verifySnapshotTicket(tampered)).toThrowError(
        expect.objectContaining({ statusCode: 401 })
      )
    })
  })

  it('falls back to the PocketBase admin password when no dedicated secret is set', () => {
    const previousPreview = process.env.NUXT_PREVIEW_SIGNING_SECRET
    const previousLicence = process.env.NUXT_LICENCE_SIGNING_SECRET
    const previousAdmin = process.env.NUXT_PB_ADMIN_PASSWORD
    delete process.env.NUXT_PREVIEW_SIGNING_SECRET
    delete process.env.NUXT_LICENCE_SIGNING_SECRET
    process.env.NUXT_PB_ADMIN_PASSWORD = 'local-admin-password'
    try {
      const ticket = signSnapshotTicket({
        uid: 'user-1',
        siteId: 'site-1',
        pageId: 'page-1'
      })
      expect(verifySnapshotTicket(ticket).pageId).toBe('page-1')
    } finally {
      if (previousPreview === undefined) delete process.env.NUXT_PREVIEW_SIGNING_SECRET
      else process.env.NUXT_PREVIEW_SIGNING_SECRET = previousPreview
      if (previousLicence === undefined) delete process.env.NUXT_LICENCE_SIGNING_SECRET
      else process.env.NUXT_LICENCE_SIGNING_SECRET = previousLicence
      if (previousAdmin === undefined) delete process.env.NUXT_PB_ADMIN_PASSWORD
      else process.env.NUXT_PB_ADMIN_PASSWORD = previousAdmin
    }
  })
})
