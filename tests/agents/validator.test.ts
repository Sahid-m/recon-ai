import { describe, it, expect, vi } from 'vitest'
import type { ParsedRow } from '../../lib/schema'

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      rows: [
        {
          clientName: 'John Smith',
          planNumber: 'QU-12345',
          feeType: 'Ongoing Adviser Charge',
          grossAmount: 150.00,
          paymentDate: '2024-10-01',
          platformName: 'Quilter',
          confidence: 0.95,
          flagged: false,
        },
        {
          clientName: '',
          planNumber: 'QU-99999',
          feeType: 'Unknown',
          grossAmount: 0,
          paymentDate: '???',
          platformName: 'Quilter',
          confidence: 0.40,
          flagged: true,
        },
      ],
    },
  }),
}))

vi.mock('../../lib/model', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
}))

const mockRows: ParsedRow[] = [
  {
    clientName: 'John Smith',
    planNumber: 'QU-12345',
    feeType: 'Ongoing Adviser Charge',
    grossAmount: 150.00,
    paymentDate: '2024-10-01',
    platformName: 'Quilter',
  },
  {
    clientName: '',
    planNumber: 'QU-99999',
    feeType: 'Unknown',
    grossAmount: 0,
    paymentDate: '???',
    platformName: 'Quilter',
  },
]

describe('validate', () => {
  it('returns validated rows with confidence and flagged', async () => {
    const { validate } = await import('../../agents/validator')
    const result = await validate(mockRows)
    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBe(0.95)
    expect(result[0].flagged).toBe(false)
    expect(result[1].confidence).toBe(0.40)
    expect(result[1].flagged).toBe(true)
  })

  it('returns empty array for empty input without calling AI', async () => {
    const { validate } = await import('../../agents/validator')
    const result = await validate([])
    expect(result).toHaveLength(0)
  })
})
