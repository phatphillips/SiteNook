import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { renderCsvArchive } from '../../../src/reports/csvRenderer.js'

describe('csvRenderer', () => {
  it('creates a zip with one csv per section', async () => {
    const archive = await renderCsvArchive([
      { key: 'qa.links', label: 'QA Broken Links', headers: ['url', 'status'], rows: [['https://example.com', 'broken']] },
      { key: 'seo.technical', label: 'SEO Technical', headers: ['rule', 'severity'], rows: [['missing-title', 'serious']] }
    ])
    const zip = await JSZip.loadAsync(archive)
    expect(Object.keys(zip.files)).toContain('qa-links.csv')
    expect(Object.keys(zip.files)).toContain('seo-technical.csv')
  })
})
