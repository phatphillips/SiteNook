import type { Page } from 'playwright'

export interface BrokenLinkRecord {
  href: string
  status_code: number
  link_type: 'internal' | 'external'
  status: 'broken' | 'redirected'
}

const TIMEOUT_MS = 5000

export async function checkLinksOnPage(page: Page, origin: string): Promise<BrokenLinkRecord[]> {
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(h => h && !h.startsWith('mailto:') && !h.startsWith('tel:'))
  )

  const unique = [...new Set(hrefs)]
  const results: BrokenLinkRecord[] = []

  await Promise.all(unique.map(async (href) => {
    try {
      const linkType = href.startsWith(origin) ? 'internal' : 'external'
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch(href, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'manual'
      })
      clearTimeout(timeout)

      const status = response.status
      if (status >= 400) {
        results.push({ href, status_code: status, link_type: linkType, status: 'broken' })
      } else if (status >= 300 && status < 400) {
        results.push({ href, status_code: status, link_type: linkType, status: 'redirected' })
      }
    } catch {
      results.push({
        href,
        status_code: 0,
        link_type: href.startsWith(origin) ? 'internal' : 'external',
        status: 'broken'
      })
    }
  }))

  return results
}
