import { describe, expect, it } from 'vitest'
import { extractReadablePageContent } from '~/utils/extractReadablePageText'

const STORY = `I had ventured deep into the heart of the forest that day, my heart alive with the joy of nature's embrace.

When I got back home, I found myself alone, sitting in my comfy chair.`

const NEXT_DATA_HTML = `<!DOCTYPE html><html><head><style>.noise{color:red}</style></head><body>
<nav>Garrit's Notes Blog Contact</nav>
<article><p>Should not use this stub.</p></article>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"post":{"markdownBody":${JSON.stringify(STORY)}}}}}</script>
</body></html>`

const NOISY_HTML = `<!DOCTYPE html><html><body>
<style>.web-share-fade{animation:rwsFade .5s}</style>
<nav>Garrit's NotesBlogContact</nav>
<article>
<p>I had ventured deep into the heart of the forest that day, my heart alive with the joy of nature's embrace.</p>
<p>When I got back home, I found myself alone, sitting in my comfy chair.</p>
</article>
<footer>© 2018-2026 Garrit Franke</footer>
{"props":{"pageProps":{"post":{"markdownBody":"ignored"}}}}
</body></html>`

describe('extractReadablePageContent', () => {
  it('prefers markdownBody from __NEXT_DATA__', () => {
    const { text, html } = extractReadablePageContent(NEXT_DATA_HTML)
    expect(text).toContain('heart of the forest')
    expect(text).not.toContain('Garrit\'s Notes')
    expect(text).not.toContain('web-share-fade')
    expect(html).toContain('<p>')
    expect(html).not.toContain('Should not use this stub')
  })

  it('extracts article paragraphs from noisy HTML', () => {
    const { text } = extractReadablePageContent(NOISY_HTML)
    expect(text).toContain('heart of the forest')
    expect(text).toContain('comfy chair')
    expect(text).not.toContain('web-share-fade')
    expect(text).not.toContain('Garrit\'s NotesBlogContact')
    expect(text).not.toContain('"props"')
    expect(text).toContain('\n\n')
  })

  it('strips fenced code blocks from markdown snapshots', () => {
    const markdown = `Intro paragraph about TypeScript configs.

\`\`\`js
export default defineConfig({ plugins: [] })
\`\`\`

Closing paragraph about webpack and vite.`
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { post: { markdownBody: markdown } } }
    })}</script>`

    const { text } = extractReadablePageContent(html)
    expect(text).not.toContain('defineConfig')
    expect(text).toContain('Intro paragraph')
    expect(text).toContain('webpack and vite')
  })

  it('excludes inline code and tables from article HTML', () => {
    const html = `<!DOCTYPE html><html><body><article>
      <p>Use the helper in your project setup today.</p>
      <p>Call <code>defineConfig()</code> in both webpack and vite configs.</p>
      <table><tr><th>Name</th><th>Value</th></tr><tr><td>foo</td><td>bar</td></tr></table>
      <p>Readers should only see prose paragraphs like this one.</p>
    </article></body></html>`

    const { text } = extractReadablePageContent(html)
    expect(text).not.toContain('defineConfig')
    expect(text).not.toContain('foo')
    expect(text).toContain('helper in your project')
    expect(text).toContain('Readers should only see prose')
  })
})
