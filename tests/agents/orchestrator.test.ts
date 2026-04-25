import { describe, it, expect, vi } from 'vitest'

vi.mock('../../agents/classifier', () => ({
  classify: vi.fn().mockResolvedValue({
    platform: 'Quilter',
    quirks: [],
    columnMap: { clientName: 'A', planNumber: 'B', feeType: 'C', grossAmount: 'D', paymentDate: 'E' },
  }),
}))

vi.mock('../../agents/parser', () => ({
  parse: vi.fn().mockResolvedValue([
    { clientName: 'John Smith', planNumber: 'QU-1', feeType: 'OAC', grossAmount: 150, paymentDate: '2024-10-01', platformName: 'Quilter' },
  ]),
}))

vi.mock('../../agents/validator', () => ({
  validate: vi.fn().mockResolvedValue([
    { clientName: 'John Smith', planNumber: 'QU-1', feeType: 'OAC', grossAmount: 150, paymentDate: '2024-10-01', platformName: 'Quilter', confidence: 0.95, flagged: false },
  ]),
}))

vi.mock('../../lib/converters', () => ({
  convertFile: vi.fn().mockResolvedValue({ sheets: { Sheet1: 'A,B,C,D,E\nJohn Smith,QU-1,OAC,150,2024-10-01' } }),
}))

describe('orchestrate', () => {
  it('returns success with validated rows for a valid file', async () => {
    const { orchestrate } = await import('../../agents/orchestrator')
    const file = new File(['dummy'], 'test.csv', { type: 'text/csv' })
    const result = await orchestrate(file)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].confidence).toBe(0.95)
    }
  })

  it('returns failure when converter throws', async () => {
    const { convertFile } = await import('../../lib/converters')
    vi.mocked(convertFile).mockRejectedValueOnce(new Error('Unsupported file type'))
    const { orchestrate } = await import('../../agents/orchestrator')
    const file = new File(['dummy'], 'test.html', { type: 'text/html' })
    const result = await orchestrate(file)
    expect(result.success).toBe(false)
  })
})
