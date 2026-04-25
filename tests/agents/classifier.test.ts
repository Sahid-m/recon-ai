import { describe, it, expect, vi } from 'vitest'

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      platform: 'Quilter',
      quirks: ['two-tab-split'],
      columnMap: {
        clientName: 'A',
        planNumber: 'B',
        feeType: 'C',
        grossAmount: 'D',
        paymentDate: 'E',
      },
    },
  }),
}))

vi.mock('../../lib/model', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
}))

describe('classify', () => {
  it('returns platform, quirks, and columnMap', async () => {
    const { classify } = await import('../../agents/classifier')
    const result = await classify({ Sheet1: 'Client,Plan,Fee,Amount,Date\nJohn,QU-1,OAC,150,2024-10-01' })
    expect(result.platform).toBe('Quilter')
    expect(result.quirks).toContain('two-tab-split')
    expect(result.columnMap.clientName).toBe('A')
    expect(result.columnMap.grossAmount).toBe('D')
  })
})
