import { describe, expect, it } from 'vitest'

import {

  activeReportProgressStage,

  clampReportProgress,

  isReportJobActive,

  reportStatusHeadline

} from '~/utils/reportJobProgress'



describe('reportJobProgress', () => {

  it('clamps progress between 0 and 100', () => {

    expect(clampReportProgress(-5)).toBe(0)

    expect(clampReportProgress(42.6)).toBe(43)

    expect(clampReportProgress(140)).toBe(100)

    expect(clampReportProgress(undefined)).toBe(0)

  })



  it('maps progress to the active stage', () => {

    expect(activeReportProgressStage(0).id).toBe('queued')

    expect(activeReportProgressStage(12).id).toBe('preparing')

    expect(activeReportProgressStage(45).id).toBe('rendering')

    expect(activeReportProgressStage(90).id).toBe('pdf')

    expect(activeReportProgressStage(100).id).toBe('complete')

  })



  it('detects active jobs', () => {

    expect(isReportJobActive('pending')).toBe(true)

    expect(isReportJobActive('processing')).toBe(true)

    expect(isReportJobActive('complete')).toBe(false)

    expect(isReportJobActive('failed')).toBe(false)

  })



  it('prefers server progress labels', () => {

    expect(reportStatusHeadline('processing', 'Rendering Accessibility Issues')).toBe('Rendering Accessibility Issues')

    expect(reportStatusHeadline('pending')).toBe('Queued — waiting for the scanner')

    expect(reportStatusHeadline('complete')).toBe('Report ready')

  })

})


