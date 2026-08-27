import { describe, expect, it, vi } from 'vitest'
import { pocketBaseFileUrl } from '../../../src/db/pocketbaseFileUrl.js'

describe('pocketBaseFileUrl', () => {
  it('prefers getURL when both methods exist so getUrl cannot throw', () => {
    const getURL = vi.fn(() => 'https://pb.test/new')
    const getUrl = vi.fn(() => {
      throw new Error('Please replace pb.files.getUrl() with pb.files.getURL()')
    })
    const url = pocketBaseFileUrl(
      { files: { getURL, getUrl } },
      { id: 'rec1' },
      'snapshot.html'
    )
    expect(url).toBe('https://pb.test/new')
    expect(getURL).toHaveBeenCalledOnce()
    expect(getUrl).not.toHaveBeenCalled()
  })

  it('falls back to getUrl for PocketBase JS SDK 0.25', () => {
    const getUrl = vi.fn(() => 'https://pb.test/old')
    const url = pocketBaseFileUrl(
      { files: { getUrl } },
      { id: 'rec1' },
      'file.pdf'
    )
    expect(url).toBe('https://pb.test/old')
    expect(getUrl).toHaveBeenCalledWith({ id: 'rec1' }, 'file.pdf', undefined)
  })
})
