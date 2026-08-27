import { describe, expect, it } from 'vitest'
import {
  deriveBestPracticeFromStoredScan,
  hasMeaningfulStoredOverall,
  preferLiveScanScore,
  preferStoredScanScore,
  resolveBestPracticeScore
} from '~/utils/scanScores'

describe('preferStoredScanScore', () => {
  it('returns stored score when non-zero', () => {
    expect(preferStoredScanScore(71.7, 0)).toBe(71.7)
    expect(preferStoredScanScore(48.2, 100)).toBe(48.2)
  })

  it('falls back to live when stored is null, undefined, or zero', () => {
    expect(preferStoredScanScore(null, 82)).toBe(82)
    expect(preferStoredScanScore(undefined, 55)).toBe(55)
    expect(preferStoredScanScore(0, 63)).toBe(63)
  })
})

describe('preferLiveScanScore', () => {
  it('prefers live score even when stored differs', () => {
    expect(preferLiveScanScore(90, 48.2)).toBe(90)
    expect(preferLiveScanScore(0, 71.7)).toBe(0)
  })

  it('falls back to stored when live is unavailable', () => {
    expect(preferLiveScanScore(null, 82)).toBe(82)
    expect(preferLiveScanScore(undefined, 55)).toBe(55)
  })

  it('returns 0 when neither value is available', () => {
    expect(preferLiveScanScore(null, undefined)).toBe(0)
  })
})

describe('hasMeaningfulStoredOverall', () => {
  it('requires stored overall above 1', () => {
    expect(hasMeaningfulStoredOverall({ score_overall: 65 })).toBe(true)
    expect(hasMeaningfulStoredOverall({ score_overall: 1 })).toBe(false)
    expect(hasMeaningfulStoredOverall({ score_overall: 0 })).toBe(false)
    expect(hasMeaningfulStoredOverall(null)).toBe(false)
  })
})

describe('deriveBestPracticeFromStoredScan', () => {
  it('returns null when overall is missing or zero', () => {
    expect(deriveBestPracticeFromStoredScan({})).toBeNull()
    expect(deriveBestPracticeFromStoredScan({ score_overall: 0, score_a: 50 })).toBeNull()
  })

  it('derives best-practice progress from stored overall minus weighted WCAG earned', () => {
    const scan = {
      score_overall: 65,
      score_a: 71.7,
      score_aa: 48.2,
      score_aaa: 97
    }
    const result = deriveBestPracticeFromStoredScan(scan)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0)
    expect(result!).toBeLessThanOrEqual(100)
  })
})

describe('resolveBestPracticeScore', () => {
  it('prefers stored score_best_practices over live', () => {
    expect(resolveBestPracticeScore({ score_best_practices: 100 }, 0)).toBe(100)
  })

  it('falls back to live when stored is missing and derive is unavailable', () => {
    expect(resolveBestPracticeScore({}, 82)).toBe(82)
  })
})
