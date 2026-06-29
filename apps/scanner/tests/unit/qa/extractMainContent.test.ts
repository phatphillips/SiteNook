/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { scoreAllReadabilityMethods } from '../../../src/qa/readabilityMethods.js'
import { countWords, extractMainContentTextInPage } from '../../../src/qa/extractMainContent.js'

const STORY = `I had ventured deep into the heart of the forest that day, my heart alive with the joy of nature's embrace.

When I got back home, I found myself alone, sitting in my comfy chair.`

function setPageHtml(html: string) {
  document.documentElement.innerHTML = html
}

describe('extractMainContentTextInPage', () => {
  it('prefers markdownBody from __NEXT_DATA__ over nav chrome', () => {
    setPageHtml(`<html><body>
      <nav>Garrit's Notes Blog Contact More</nav>
      <article><p>Stub article text that should not win.</p></article>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
        props: { pageProps: { post: { markdownBody: STORY } } }
      })}</script>
    </body></html>`)

    const text = extractMainContentTextInPage()
    expect(text).toContain('heart of the forest')
    expect(text).not.toContain('Garrit\'s Notes')
    expect(text).not.toContain('Stub article')
  })

  it('extracts article content and ignores nav/footer', () => {
    setPageHtml(`<html><body>
      <nav>Garrit's Notes Blog Contact</nav>
      <article>
        <p>I had ventured deep into the heart of the forest that day, my heart alive with the joy of nature's embrace.</p>
        <p>When I got back home, I found myself alone, sitting in my comfy chair.</p>
      </article>
      <footer>© 2018-2026 Garrit Franke Privacy Source Code</footer>
    </body></html>`)

    const text = extractMainContentTextInPage()
    expect(text).toContain('heart of the forest')
    expect(text).toContain('comfy chair')
    expect(text).not.toContain('Garrit\'s Notes')
    expect(text).not.toContain('Privacy Source Code')
  })

  it('excludes code blocks from readability text', () => {
    setPageHtml(`<html><body><article>
      <p>TypeScript config files are a great way to add safety to your build setup.</p>
      <pre>export default defineConfig({ plugins: [] })</pre>
      <p>You can simply reuse the same helper in both webpack and vite projects.</p>
    </article></body></html>`)

    const text = extractMainContentTextInPage()
    expect(text).not.toContain('defineConfig')
    expect(text).toContain('TypeScript config files')
    expect(text).toContain('webpack and vite')
  })

  it('excludes inline code and tables from article text', () => {
    setPageHtml(`<html><body><article>
      <p>Use the helper in your project setup today.</p>
      <p>Call <code>defineConfig()</code> in both webpack and vite configs.</p>
      <table><tr><th>Name</th><th>Value</th></tr><tr><td>foo</td><td>bar</td></tr></table>
      <p>Readers should only see prose paragraphs like this one.</p>
    </article></body></html>`)

    const text = extractMainContentTextInPage()
    expect(text).not.toContain('defineConfig')
    expect(text).not.toContain('foo')
    expect(text).toContain('helper in your project')
    expect(text).toContain('Readers should only see prose')
  })

  it('produces reasonable FK-GL on article-only text', () => {
    setPageHtml(`<html><body>
      <nav>${'Navigation '.repeat(200)}</nav>
      <article>
        <p>${'This is a clear sentence about open source practices. '.repeat(40)}</p>
        <p>${'Teams should document decisions in plain language every time. '.repeat(40)}</p>
      </article>
      <footer>${'Footer links '.repeat(100)}</footer>
    </body></html>`)

    const mainText = extractMainContentTextInPage()
    const bodyText = document.body?.innerText || ''
    const mainScores = scoreAllReadabilityMethods(mainText)
    const bodyScores = scoreAllReadabilityMethods(bodyText)

    expect(countWords(mainText)).toBeLessThan(countWords(bodyText))
    expect(mainScores.flesch_kincaid_grade!).toBeLessThan(bodyScores.flesch_kincaid_grade!)
    expect(mainScores.flesch_kincaid_grade!).toBeLessThan(20)
  })
})
