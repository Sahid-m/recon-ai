import { describe, it, expect, vi } from 'vitest'
import type { ClassifierOutput } from '../../agents/classifier'

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
        },
      ],
    },
  }),
}))

vi.mock('../../lib/model', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
}))

const mockClassifierOutput: ClassifierOutput = {
  platform: 'Quilter',
  quirks: [],
  columnMap: {
    clientName: 'A',
    planNumber: 'B',
    feeType: 'C',
    grossAmount: 'D',
    paymentDate: 'E',
  },
}

describe('parse', () => {
  it('returns an array of ParsedRows', async () => {
    const { parse } = await import('../../agents/parser')
    const rows = await parse(
      { Sheet1: 'A,B,C,D,E\nJohn Smith,QU-12345,OAC,150,2024-10-01' },
      mockClassifierOutput,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].clientName).toBe('John Smith')
    expect(rows[0].grossAmount).toBe(150.00)
  })
})
