import type { PdfIssue } from '~/types/sitenook'

export interface PdfIssueGuidance {
  summary: string
  fixSteps: string[]
  learnMoreUrl?: string
}

const GUIDANCE: Record<string, PdfIssueGuidance> = {
  'The document has no title': {
    summary: 'Screen readers and browser tabs rely on the document title. Untitled PDFs are harder to identify and navigate.',
    fixSteps: [
      'Open the PDF in Adobe Acrobat Pro (or similar) and set Document Properties → Title.',
      'Enable “Display document title” in the Initial View settings.',
      'Re-export the PDF with title metadata embedded (dc:title in XMP).'
    ],
    learnMoreUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html'
  },
  'The document contains no headings': {
    summary: 'Headings provide structure so assistive technology users can skim and navigate long documents.',
    fixSteps: [
      'Tag content with heading levels (H1–H6) in your authoring tool or Acrobat’s Reading Order / Tags panel.',
      'Use one H1 for the main document title, then nested headings for sections.',
      'Avoid styling normal text as headings. Use actual heading tags.'
    ],
    learnMoreUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html'
  },
  'The image has no alternative presentation': {
    summary: 'Figures and images need alt text so non-visual users understand their meaning.',
    fixSteps: [
      'In the Tags panel, locate Figure elements and add alternate text describing the image’s purpose.',
      'Mark decorative images as artifacts so they are ignored by assistive technology.',
      'For complex figures, provide a longer description in the tag or nearby body text.'
    ],
    learnMoreUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html'
  },
  'The table has no table headings': {
    summary: 'Data tables need header cells (TH) so screen readers can associate values with column/row labels.',
    fixSteps: [
      'Tag the header row with TH cells and set scope="col" or scope="row".',
      'Use the Table Editor in Acrobat to assign header cells.',
      'Keep layout tables separate from data tables. Only data tables need headers.'
    ],
    learnMoreUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html'
  },
  'Content is not properly tagged': {
    summary: 'All meaningful content must be tagged so assistive technology can read it in logical order.',
    fixSteps: [
      'Run “Autotag Document” in Acrobat, then review and fix the tag tree.',
      'Mark headers, footers, and page numbers as artifacts where appropriate.',
      'Verify reading order matches the visual layout.'
    ],
    learnMoreUrl: 'https://www.pdfa.org/resource/pdf-ua-1-in-a-nutshell/'
  },
  'The document is not tagged': {
    summary: 'PDF/UA requires a structure tree (StructTreeRoot) so content is accessible to assistive technology.',
    fixSteps: [
      'Add tags to the document using your PDF editor’s accessibility tools.',
      'Ensure MarkInfo/Marked is true in the document catalog.',
      'Validate again after re-exporting from an accessible source file.'
    ],
    learnMoreUrl: 'https://www.pdfa.org/resource/pdf-ua-1-in-a-nutshell/'
  },
  'Text language is not specified': {
    summary: 'Language metadata helps screen readers pronounce text correctly.',
    fixSteps: [
      'Set the document language in File → Properties → Advanced → Language.',
      'Tag foreign-language passages with the correct lang attribute in the structure tree.'
    ],
    learnMoreUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html'
  }
}

const DEFAULT_GUIDANCE: PdfIssueGuidance = {
  summary:
    'This PDF/UA validation rule failed. Review the technical description and update the document structure or metadata. Re-validate after changes. Assisted tagging is not certified PDF/UA.',
  fixSteps: [
    'Review the rule description and evidence in PDF Inspector → Audit.',
    'Fix tags, alt text, or metadata in Acrobat, PAC, or your authoring tool.',
    'Re-validate the PDF after saving.'
  ],
  learnMoreUrl: 'https://www.pdfa.org/resource/pdf-ua-1-in-a-nutshell/'
}

export function getPdfIssueGuidance(issue: Pick<PdfIssue, 'title' | 'description'>): PdfIssueGuidance {
  return GUIDANCE[issue.title] ?? DEFAULT_GUIDANCE
}

export function formatPdfIssueEvidence(evidence?: Record<string, unknown>): string | null {
  if (!evidence) return null
  const context = evidence.context
  if (typeof context === 'string' && context.trim()) return context.trim()
  return null
}
