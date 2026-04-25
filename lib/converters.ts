import * as XLSX from 'xlsx'

export type ConvertedFile = {
  sheets: Record<string, string>
}

export async function convertFile(file: File): Promise<ConvertedFile> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    return convertPdf(buffer)
  }
  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv'].includes(ext ?? '')) {
    return convertExcel(buffer)
  }
  throw new Error(`Unsupported file type: .${ext}`)
}

function convertExcel(buffer: Buffer): ConvertedFile {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets: Record<string, string> = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim()) {
      sheets[sheetName] = csv
    }
  }

  return { sheets }
}

async function convertPdf(buffer: Buffer): Promise<ConvertedFile> {
  // pdf-parse ESM build exports the function as the module itself (no .default)
  const pdfParseModule = await import('pdf-parse')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
    (pdfParseModule as any).default ?? (pdfParseModule as any)
  return { sheets: { PDF: (await pdfParse(buffer)).text } }
}
