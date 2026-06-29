import { describe, it, expect } from 'vitest'
import { pbAnd, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'

describe('pbFilter', () => {
  it('pbSelect uses single quotes for enum values', () => {
    expect(pbSelect('status', 'complete')).toBe("status = 'complete'")
  })

  it('pbRelation uses double quotes for record ids', () => {
    expect(pbRelation('site', 'abc123')).toBe('site = "abc123"')
  })

  it('pbOr joins clauses', () => {
    expect(pbOr([pbSelect('status', 'pending'), pbSelect('status', 'processing')])).toBe(
      "(status = 'pending' || status = 'processing')"
    )
  })

  it('pbAnd joins clauses', () => {
    expect(pbAnd([pbRelation('site', 'x'), pbSelect('status', 'running')])).toBe(
      'site = "x" && status = \'running\''
    )
  })
})
