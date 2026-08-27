import { describe, expect, it } from 'vitest'
import {
  buildCommunityApplianceStatus,
  buildLicensedApplianceStatus,
  isApplianceDeploymentMode
} from '../../../server/utils/applianceLicenceStatus'

describe('applianceLicenceStatus', () => {
  it('detects appliance modes', () => {
    expect(isApplianceDeploymentMode('appliance')).toBe(true)
    expect(isApplianceDeploymentMode('cloud')).toBe(false)
  })

  it('builds community free caps', () => {
    const status = buildCommunityApplianceStatus()
    expect(status.upgradeRequired).toBe(true)
    expect(status.maxPagesPerScan).toBe(20)
    expect(status.maxSites).toBe(1)
  })

  it('builds selfhost business caps', () => {
    const status = buildLicensedApplianceStatus('selfhost')
    expect(status.upgradeRequired).toBe(false)
    expect(status.maxPagesPerScan).toBe(5_000)
    expect(status.plan).toBe('business')
  })
})
