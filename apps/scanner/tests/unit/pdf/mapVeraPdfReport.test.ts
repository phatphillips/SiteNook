import { describe, expect, it } from 'vitest'
import { mapVeraPdfReport, toFriendlyPdfIssueTitle } from '../../../src/pdf/mapVeraPdfReport.js'
import { normalizeVeraPdfResponse, type VeraPdfValidationResponse } from '../../../src/pdf/veraPdfClient.js'

describe('normalizeVeraPdfResponse', () => {
  it('unwraps veraPDF REST batch response with ruleSummaries', () => {
    const raw = {
      report: {
        jobs: [{
          validationResult: [{
            compliant: false,
            profileName: 'PDF/UA-1 validation profile',
            details: {
              ruleSummaries: [{
                ruleStatus: 'FAILED',
                status: 'failed',
                description: 'The document catalog dictionary shall include a ViewerPreferences dictionary containing a DisplayDocTitle key, whose value shall be true',
                failedChecks: 1,
                clause: '7.1',
                testNumber: 10,
                tags: ['syntax'],
                checks: [{
                  status: 'failed',
                  context: 'root'
                }]
              }, {
                ruleStatus: 'FAILED',
                status: 'failed',
                description: 'An annotation shall have either Contents key or an Alt entry in the enclosing structure element',
                failedChecks: 8,
                clause: '7.18.1',
                testNumber: 2,
                tags: ['alt-text'],
                checks: [{
                  status: 'failed',
                  context: 'root/document[0]/pages[0]/annots[0]'
                }]
              }]
            }
          }]
        }]
      }
    }

    const normalized = normalizeVeraPdfResponse(raw)
    expect(normalized.compliant).toBe(false)
    expect(normalized.validationResult).toHaveLength(2)
    expect(normalized.validationResult?.[0]?.failedChecks).toBe(1)
    expect(normalized.validationResult?.[1]?.failedChecks).toBe(8)
  })
})

describe('mapVeraPdfReport', () => {
  it('maps failed checks into grouped issues and score', () => {
    const report: VeraPdfValidationResponse = {
      compliant: false,
      profileName: 'PDF/UA-1',
      validationResult: [
        {
          statement: 'The document catalog dictionary shall include a ViewerPreferences dictionary containing a DisplayDocTitle key, whose value shall be true',
          failedChecks: 1,
          checks: [
            {
              status: 'failed',
              errorMessage: 'DisplayDocTitle is false',
              location: 'root'
            }
          ]
        },
        {
          statement: 'An annotation shall have either Contents key or an Alt entry in the enclosing structure element',
          failedChecks: 2,
          checks: [
            {
              status: 'failed',
              errorMessage: 'The image has no alternative presentation',
              location: 'page 1',
              context: 'Figure element'
            },
            {
              status: 'failed',
              errorMessage: 'The image has no alternative presentation',
              location: 'page 2',
              context: 'Figure element'
            }
          ]
        }
      ]
    }

    const mapped = mapVeraPdfReport(report)

    expect(mapped.compliant).toBe(false)
    expect(mapped.issueCount).toBe(3)
    expect(mapped.issues).toHaveLength(2)
    expect(mapped.issues.find(i => i.title === 'The document has no title')?.category).toBe('document')
    expect(
      mapped.issues.find(i => i.title === 'The image has no alternative presentation')?.occurrence_count
    ).toBe(2)
    expect(mapped.accessibilityScore).toBeLessThan(100)
    expect(mapped.hasPdfTags).toBe(true)
  })

  it('maps veraPDF REST output into Siteimprove-style titles', () => {
    const normalized = normalizeVeraPdfResponse({
      report: {
        jobs: [{
          validationResult: [{
            compliant: false,
            details: {
              ruleSummaries: [{
                status: 'failed',
                description: 'The document catalog dictionary shall include a ViewerPreferences dictionary containing a DisplayDocTitle key, whose value shall be true',
                failedChecks: 1,
                checks: [{ status: 'failed', context: 'root' }]
              }, {
                status: 'failed',
                description: 'The logical structure of the conforming file shall be described by a structure hierarchy rooted in the StructTreeRoot entry',
                failedChecks: 1,
                checks: [{ status: 'failed', context: 'root/document[0]' }]
              }]
            }
          }]
        }]
      }
    })

    const mapped = mapVeraPdfReport(normalized)
    expect(mapped.issueCount).toBe(2)
    expect(mapped.hasPdfTags).toBe(false)
    expect(mapped.machineReadable).toBe(false)
    expect(mapped.issues.some(i => i.title === 'The document has no title')).toBe(true)
    expect(mapped.issues.some(i => i.title === 'The document is not tagged')).toBe(true)
  })

  it('returns perfect score for compliant empty report', () => {
    const mapped = mapVeraPdfReport({ compliant: true, validationResult: [] })
    expect(mapped.issueCount).toBe(0)
    expect(mapped.accessibilityScore).toBe(100)
    expect(mapped.compliant).toBe(true)
    expect(mapped.hasPdfTags).toBe(true)
    expect(mapped.machineReadable).toBe(true)
  })
})

describe('toFriendlyPdfIssueTitle', () => {
  it('maps common veraPDF descriptions to readable titles', () => {
    expect(toFriendlyPdfIssueTitle('The document catalog dictionary shall include a DisplayDocTitle key')).toBe('The document has no title')
    expect(toFriendlyPdfIssueTitle('An annotation shall have an Alt entry')).toBe('The image has no alternative presentation')
    expect(toFriendlyPdfIssueTitle('TD does not contain Headers attribute for table headings')).toBe('The table has no table headings')
  })
})
