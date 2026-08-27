import { ASTRA_EMPTY_DESKTOP_HEADER_CSS } from './astraHeaderPreviewCss'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

const PREVIEW_SHIM = `<script data-accessiq-preview>
(function () {
  function memoryStorage() {
    var map = {};
    return {
      get length() { return Object.keys(map).length; },
      key: function (i) { return Object.keys(map)[i] || null; },
      getItem: function (key) {
        key = String(key);
        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
      },
      setItem: function (key, value) { map[String(key)] = String(value); },
      removeItem: function (key) { delete map[String(key)]; },
      clear: function () {
        for (var k in map) {
          if (Object.prototype.hasOwnProperty.call(map, k)) delete map[k];
        }
      }
    };
  }
  var local = memoryStorage();
  var session = memoryStorage();
  function installStorage(target) {
    Object.defineProperty(target, "localStorage", { configurable: true, enumerable: true, get: function () { return local; } });
    Object.defineProperty(target, "sessionStorage", { configurable: true, enumerable: true, get: function () { return session; } });
  }
  try { installStorage(Window.prototype); } catch (e) {}
  try { installStorage(window); } catch (e) {}
  try {
    Object.defineProperty(window, "top", { get: function () { return window.self; } });
    Object.defineProperty(window, "parent", { get: function () { return window.self; } });
  } catch (e) {}
})();
</script>`

/**
 * Directory form of the page URL so relative CSS/JS/images resolve correctly.
 * WordPress permalinks have no file extension; treat the last path segment as a folder.
 */
export function previewBaseHref(pageUrl: string): string {
  try {
    const url = new URL(pageUrl)
    if (!url.pathname.endsWith('/')) {
      const last = url.pathname.split('/').pop() || ''
      if (!/\.[a-z0-9]{1,8}$/i.test(last)) url.pathname += '/'
    }
    return url.href
  } catch {
    return pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`
  }
}

export function canonicalUrlFromHtml(html: string, pageUrl?: string): string | null {
  const canonical = html.match(
    /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)/i
  )?.[1] || html.match(
    /<link\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i
  )?.[1] || html.match(
    /<meta\b[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)/i
  )?.[1]
  if (!canonical) return null
  const decoded = canonical.replace(/&amp;/g, '&').trim()
  if (!decoded) return null
  try {
    return new URL(decoded, pageUrl || undefined).href
  } catch {
    return null
  }
}

export function livePageUrlCandidates(pageUrl: string): string[] {
  const out: string[] = []
  const add = (value: string) => {
    if (value && !out.includes(value)) out.push(value)
  }
  add(pageUrl)
  try {
    const url = new URL(pageUrl)
    const slash = new URL(url.href)
    if (url.pathname.endsWith('/')) {
      slash.pathname = url.pathname.replace(/\/+$/, '') || '/'
    } else {
      slash.pathname = `${url.pathname}/`
    }
    add(slash.href)

    const hosts = [url.hostname]
    if (url.hostname.startsWith('www.')) hosts.push(url.hostname.slice(4))
    else hosts.push(`www.${url.hostname}`)

    for (const host of hosts) {
      for (const path of [url.pathname, slash.pathname]) {
        const next = new URL(url.href)
        next.hostname = host
        next.pathname = path
        add(next.href)
      }
    }
  } catch {
    // ignore invalid
  }
  return out
}

function stripPreviewTrackers(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    if (/siteanalyze|fbevents|facebook\.net|googletagmanager|google-analytics|gtag\(|fbq\(/i.test(block)) {
      return ''
    }
    return block
  })
}

/**
 * Prepare page HTML so it can run inside SiteNook's preview iframe.
 * Scripts stay intact. A <base href> makes CSS/JS/images resolve on the live origin.
 */
export function prepareLivePreviewHtml(html: string, pageUrl: string): string {
  let out = html.trim()
  if (!out) return ''

  out = out.replace(/<base\b[^>]*>/gi, '')
  out = out.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?(?:content-security-policy|x-frame-options)["']?[^>]*>/gi,
    ''
  )
  out = stripPreviewTrackers(out)

  const headInsert = `<base href="${escapeAttr(previewBaseHref(pageUrl))}">${ASTRA_EMPTY_DESKTOP_HEADER_CSS}${PREVIEW_SHIM}`
  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${headInsert}`)
  } else if (/<html[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${headInsert}</head>`)
  } else {
    out = `<!DOCTYPE html><html><head>${headInsert}<meta charset="utf-8"></head><body>${out}</body></html>`
  }
  return out
}
