import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import {
  accessibilityTargetRows,
  getDefaultSiteSettings,
  issueInSiteTarget,
  levelsForConformance,
  parseSiteSettings,
  qaTargetRows,
  serializeSiteSettings
} from '~/utils/siteSettings'

describe('parseSiteSettings', () => {
  it('defaults when empty', () => {
    const settings = parseSiteSettings(null)
    expect(settings.wcagVersion).toBe('2.2')
    expect(settings.wcagConformance).toBe('AA')
    expect(settings.includeIssues).toBe(true)
  })

  it('migrates legacy scan config fields', () => {
    const settings = parseSiteSettings(null, {
      wcagVersion: '2.1',
      wcagLevels: ['A', 'AA', 'AAA'],
      bestPractices: false,
      checkLinks: true
    })
    expect(settings.wcagVersion).toBe('2.1')
    expect(settings.wcagConformance).toBe('AAA')
    expect(settings.bestPractices).toBe(false)
  })

  it('serializeSiteSettings returns a plain object from reactive state', () => {
    const state = reactive({ ...getDefaultSiteSettings(), wcagVersion: '2.0' as const })
    const serialized = serializeSiteSettings(state)
    expect(serialized.wcagVersion).toBe('2.0')
    expect(Object.getPrototypeOf(serialized)).toBe(Object.prototype)
  })

  it('prefers stored site_settings over legacy default_scan_config', () => {
    const settings = parseSiteSettings(
      { wcagVersion: '2.0', wcagConformance: 'A', bestPractices: false, checkLinks: false },
      { wcagVersion: '2.2', wcagLevels: ['A', 'AA', 'AAA'], bestPractices: true, checkLinks: true }
    )
    expect(settings.wcagVersion).toBe('2.0')
    expect(settings.wcagConformance).toBe('A')
    expect(settings.bestPractices).toBe(false)
    expect(settings.checkLinks).toBe(false)
  })
})

describe('issueInSiteTarget', () => {
  const settings = getDefaultSiteSettings()

  it('includes WCAG AA issues for AA target', () => {
    expect(issueInSiteTarget({
      rule_id: 'color-contrast',
      wcag_level: 'AA',
      wcag_version: '2.2',
      wcag_sc: '1.4.3',
      type: 'error'
    }, settings)).toBe(true)
  })

  it('excludes AAA when target is AA', () => {
    expect(issueInSiteTarget({
      rule_id: 'some-aaa',
      wcag_level: 'AAA',
      wcag_version: '2.2',
      wcag_sc: '1.2.6',
      type: 'error'
    }, settings)).toBe(false)
  })

  it('excludes potential issues when disabled', () => {
    expect(issueInSiteTarget({
      rule_id: 'color-contrast',
      wcag_level: 'AA',
      wcag_version: '2.2',
      type: 'review'
    }, { ...settings, includePotentialIssues: false })).toBe(false)
  })
})

describe('accessibilityTargetRows', () => {
  it('lists accessibility target fields', () => {
    const rows = accessibilityTargetRows(getDefaultSiteSettings())
    expect(rows.find(r => r.label === 'WCAG version')?.value).toBe('2.2')
    expect(rows.find(r => r.label === 'Conformance')?.value).toBe('AA')
    expect(rows.find(r => r.label === 'Potential issues')?.enabled).toBe(true)
  })
})

describe('qaTargetRows', () => {
  it('reflects disabled QA modules', () => {
    const rows = qaTargetRows({ ...getDefaultSiteSettings(), checkLinks: false, checkSpelling: false })
    expect(rows.find(r => r.label === 'Broken links')?.enabled).toBe(false)
    expect(rows.find(r => r.label === 'Spell check')?.value).toBe('Off')
  })
})

describe('levelsForConformance', () => {
  it('includes lower levels for AA target', () => {
    expect(levelsForConformance('AA')).toEqual(['A', 'AA'])
  })
})
