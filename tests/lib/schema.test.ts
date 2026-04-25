import { describe, it, expect } from 'vitest'
import { ParsedRowSchema, ValidatedRowSchema } from '../../lib/schema'

describe('ParsedRowSchema', () => {
  it('accepts a valid row', () => {
    const result = ParsedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a row missing clientName', () => {
    const result = ParsedRowSchema.safeParse({
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a row with a string grossAmount', () => {
    const result = ParsedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: '150.00',
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(false)
  })
})

describe('ValidatedRowSchema', () => {
  it('accepts confidence of 0.95 and flagged false', () => {
    const result = ValidatedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
      confidence: 0.95,
      flagged: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = ValidatedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
      confidence: 1.5,
      flagged: false,
    })
    expect(result.success).toBe(false)
  })
})
