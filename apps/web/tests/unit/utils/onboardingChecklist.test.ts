import { describe, it, expect } from 'vitest'
import {
  isOnboardingChecklistComplete,
  shouldShowOnboardingChecklist
} from '~/utils/onboardingChecklist'
import type { OrganizationOnboardingState } from '~/types/sitenook'

function state(
  patch: Partial<OrganizationOnboardingState> = {}
): OrganizationOnboardingState {
  return {
    dismissed: false,
    siteAdded: false,
    firstScanStarted: false,
    ahaSeen: false,
    teammateInvited: false,
    scheduleEnabled: false,
    ...patch
  }
}

describe('onboardingChecklist', () => {
  it('is incomplete until site, scan, aha, and invite are done', () => {
    expect(isOnboardingChecklistComplete(state())).toBe(false)
    expect(isOnboardingChecklistComplete(state({
      siteAdded: true,
      firstScanStarted: true,
      ahaSeen: true
    }))).toBe(false)
    expect(isOnboardingChecklistComplete(state({
      siteAdded: true,
      firstScanStarted: true,
      ahaSeen: true,
      teammateInvited: true
    }))).toBe(true)
  })

  it('hides when dismissed even if steps remain', () => {
    expect(shouldShowOnboardingChecklist(state({ dismissed: true }))).toBe(false)
  })

  it('hides when all required milestones are complete', () => {
    expect(shouldShowOnboardingChecklist(state({
      siteAdded: true,
      firstScanStarted: true,
      ahaSeen: true,
      teammateInvited: true
    }))).toBe(false)
  })

  it('keeps showing when invite is still missing', () => {
    expect(shouldShowOnboardingChecklist(state({
      siteAdded: true,
      firstScanStarted: true,
      ahaSeen: true,
      teammateInvited: false
    }))).toBe(true)
  })

  it('does not require scheduleEnabled to hide', () => {
    expect(shouldShowOnboardingChecklist(state({
      siteAdded: true,
      firstScanStarted: true,
      ahaSeen: true,
      teammateInvited: true,
      scheduleEnabled: false
    }))).toBe(false)
  })
})
