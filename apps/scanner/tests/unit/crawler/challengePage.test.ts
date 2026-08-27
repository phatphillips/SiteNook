import { describe, it, expect, vi } from 'vitest'
import {
  challengeBlockLogMessage,
  challengeKindFromUrl,
  htmlLooksLikeSgCaptchaStub,
  isChallengeUrl,
  isWafBlockedStatus,
  looksLikeChallengeContent,
  resolveChallengeInterstitial,
  resolveNavigationChallenge,
  responseHasSgCaptcha
} from '../../../src/crawler/challengePage.js'

describe('challengePage', () => {
  it('detects SiteGround sgcaptcha URLs', () => {
    expect(
      isChallengeUrl(
        'https://riversideprimary.education.tas.edu.au/.well-known/sgcaptcha/?r=%2Fnew-students'
      )
    ).toBe(true)
    expect(challengeKindFromUrl('https://example.com/.well-known/sgcaptcha/')).toBe('sgcaptcha')
  })

  it('treats 403 and 202 as WAF-blocked statuses', () => {
    expect(isWafBlockedStatus(403)).toBe(true)
    expect(isWafBlockedStatus(202)).toBe(true)
    expect(isWafBlockedStatus(200)).toBe(false)
  })

  it('detects SG-Captcha response header', () => {
    expect(
      responseHasSgCaptcha({
        headers: () => ({ 'sg-captcha': 'challenge' })
      })
    ).toBe(true)
    expect(
      responseHasSgCaptcha({
        headers: () => ({ 'content-type': 'text/html' })
      })
    ).toBe(false)
  })

  it('detects SiteGround meta-refresh stub HTML', () => {
    const html =
      '<html><head><meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2F"></meta></head></html>'
    expect(htmlLooksLikeSgCaptchaStub(html)).toBe(true)
  })

  it('detects Cloudflare challenge paths', () => {
    expect(isChallengeUrl('https://example.com/cdn-cgi/challenge-platform/h/b')).toBe(true)
    expect(challengeKindFromUrl('https://example.com/cdn-cgi/challenge')).toBe('cloudflare')
  })

  it('does not flag normal pages', () => {
    expect(isChallengeUrl('https://example.com/about-us')).toBe(false)
    expect(isChallengeUrl('https://example.com/')).toBe(false)
  })

  it('matches known challenge body copy', () => {
    expect(looksLikeChallengeContent('Checking the site connection security')).toBe(true)
    expect(looksLikeChallengeContent('Welcome to our school')).toBe(false)
  })

  it('formats block log messages', () => {
    expect(challengeBlockLogMessage('sgcaptcha')).toMatch(/sgcaptcha/)
    expect(challengeBlockLogMessage('cloudflare')).toMatch(/cloudflare/)
    expect(challengeBlockLogMessage('challenge')).toMatch(/Security challenge/)
  })

  it('soft-waits then reports blocked when URL stays on challenge', async () => {
    const waitForTimeout = vi.fn(async () => {})
    const page = {
      url: vi.fn().mockReturnValue('https://example.com/.well-known/sgcaptcha/?r=%2F'),
      waitForTimeout
    } as unknown as import('playwright').Page

    const result = await resolveChallengeInterstitial(page, {
      softWaitMs: 1000,
      pollMs: 250
    })

    expect(result.blocked).toBe(true)
    expect(result.kind).toBe('sgcaptcha')
    expect(waitForTimeout.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('returns not blocked when challenge clears during soft wait', async () => {
    let calls = 0
    const page = {
      url: vi.fn(() => {
        calls++
        return calls <= 2
          ? 'https://example.com/.well-known/sgcaptcha/?r=%2F'
          : 'https://example.com/new-students'
      }),
      waitForTimeout: vi.fn(async () => {})
    } as unknown as import('playwright').Page

    const result = await resolveChallengeInterstitial(page, {
      softWaitMs: 5000,
      pollMs: 100
    })

    expect(result.blocked).toBe(false)
    expect(result.kind).toBeNull()
    expect(result.finalUrl).toBe('https://example.com/new-students')
  })

  it('skips soft wait when URL is not a challenge', async () => {
    const waitForTimeout = vi.fn(async () => {})
    const page = {
      url: vi.fn().mockReturnValue('https://example.com/about'),
      waitForTimeout,
      content: vi.fn().mockResolvedValue('<html><body>Hello</body></html>')
    } as unknown as import('playwright').Page

    const result = await resolveChallengeInterstitial(page)
    expect(result.blocked).toBe(false)
    expect(waitForTimeout).not.toHaveBeenCalled()
  })

  it('treats HTTP 202 + SG-Captcha as blocked when meta-refresh never leaves', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://example.com/'),
      waitForTimeout: vi.fn(async () => {}),
      content: vi.fn().mockResolvedValue(
        '<html><head><meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/?r=%2F"></meta></head></html>'
      )
    } as unknown as import('playwright').Page

    const response = {
      status: () => 202,
      headers: () => ({ 'sg-captcha': 'challenge' })
    } as unknown as import('playwright').Response

    const result = await resolveNavigationChallenge(page, response, {
      softWaitMs: 0,
      settleMs: 0,
      pollMs: 50
    })

    expect(result.blocked).toBe(true)
    expect(result.kind).toBe('sgcaptcha')
  })

  it('follows settle into sgcaptcha then reports clear', async () => {
    let calls = 0
    const page = {
      url: vi.fn(() => {
        calls++
        if (calls <= 2) return 'https://example.com/'
        if (calls <= 4) return 'https://example.com/.well-known/sgcaptcha/?r=%2F'
        return 'https://example.com/'
      }),
      waitForTimeout: vi.fn(async () => {}),
      content: vi.fn().mockResolvedValue('<html></html>')
    } as unknown as import('playwright').Page

    const response = {
      status: () => 202,
      headers: () => ({ 'sg-captcha': 'challenge' })
    } as unknown as import('playwright').Response

    const result = await resolveNavigationChallenge(page, response, {
      softWaitMs: 2000,
      settleMs: 500,
      pollMs: 100
    })

    expect(result.blocked).toBe(false)
    expect(result.finalUrl).toBe('https://example.com/')
  })
})
