import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from '../lib/model'
import { ParsedRowSchema, type ParsedRow } from '../lib/schema'
import type { ClassifierOutput } from './classifier'

const ParserOutputSchema = z.object({
  rows: z.array(ParsedRowSchema),
})

export async function parse(
  sheets: Record<string, string>,
  classifierOutput: ClassifierOutput,
): Promise<ParsedRow[]> {
  const fullText = Object.entries(sheets)
    .map(([name, csv]) => `=== Sheet: ${name} ===\n${csv}`)
    .join('\n\n')

  const { object } = await generateObject({
    model: getModel(),
    schema: ParserOutputSchema,
    prompt: `Extract all income/fee rows from this UK investment platform statement.

Platform: ${classifierOutput.platform}
Column mapping: ${JSON.stringify(classifierOutput.columnMap, null, 2)}
Known quirks: ${classifierOutput.quirks.join(', ') || 'none'}

Rules:
- Extract EVERY data row. Never drop any row, even if fields are unusual.
- clientName: use "Client Name", "Investor Name", "Client", "Name", or equivalent column.
- planNumber: use "Plan Number", "Policy Number", "Account Number", "Reference", or equivalent.
- feeType: use "Fee Type", "Transaction Type", "Charge Type", or default to "Adviser Charge".
- grossAmount: use "Gross Amount", "Net Amount", "Amount", "Fee", "Charge" — must be a POSITIVE number in GBP (strip £ and commas).
- paymentDate: use "Payment Date", "Transaction Date", "Date", "Effective Date" — convert to ISO 8601 (YYYY-MM-DD).
- platformName: always "${classifierOutput.platform}".
- If any field is missing, use a sensible default rather than dropping the row.

Statement:
${fullText}`,
  })

  return object.rows
}
