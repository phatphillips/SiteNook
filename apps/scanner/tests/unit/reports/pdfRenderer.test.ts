import { describe, expect, it } from 'vitest'
import { renderPdfReport } from '../../../src/reports/pdfRenderer.js'

describe('pdfRenderer', () => {
  it('renders PDF bytes via Playwright HTML export', async () => {
    const pdf = await renderPdfReport([
      {
        key: 'accessibility.issues',
        label: 'Accessibility Issues',
        headers: ['rule_id', 'description', 'wcag_level', 'impact', 'page_url'],
        rows: [['color-contrast', 'Elements must meet minimum color contrast ratio thresholds', 'AA', 'serious', 'https://example.com']]
      }
    ], {
      title: 'SiteNook Report',
      scopeLabel: 'All sites',
      generatedAt: new Date().toISOString()
    })

    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.slice(0, 4).toString('utf8')).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1000)
  }, 60000)
})
