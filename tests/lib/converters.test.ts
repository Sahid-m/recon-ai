import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { convertFile } from '../../lib/converters'

function makeXlsxFile(data: unknown[][]): File {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new File([buffer], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function makeCsvFile(content: string): File {
  return new File([content], 'test.csv', { type: 'text/csv' })
}

describe('convertFile', () => {
  it('converts a CSV file into a single sheet record', async () => {
    const csv = 'Client,Plan,Amount\nJohn Smith,QU-001,150.00'
    const file = makeCsvFile(csv)
    const result = await convertFile(file)
    expect(Object.keys(result.sheets)).toHaveLength(1)
    expect(Object.values(result.sheets)[0]).toContain('John Smith')
  })

  it('converts an XLSX file with one sheet', async () => {
    const data = [['Client', 'Plan', 'Amount'], ['John Smith', 'QU-001', 150]]
    const file = makeXlsxFile(data)
    const result = await convertFile(file)
    expect(result.sheets['Sheet1']).toContain('John Smith')
  })

  it('converts an XLSX file with multiple sheets', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Client'], ['A']]), 'Pension')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Client'], ['B']]), 'Non-Pension')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const file = new File([buffer], 'quilter.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const result = await convertFile(file)
    expect(result.sheets['Pension']).toBeDefined()
    expect(result.sheets['Non-Pension']).toBeDefined()
  })

  it('throws for an unsupported file type', async () => {
    const file = new File(['<html>'], 'test.html', { type: 'text/html' })
    await expect(convertFile(file)).rejects.toThrow('Unsupported file type')
  })

  it('excludes empty sheets', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Client'], ['A']]), 'Data')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Empty')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const file = new File([buffer], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const result = await convertFile(file)
    expect(result.sheets['Empty']).toBeUndefined()
  })
})
