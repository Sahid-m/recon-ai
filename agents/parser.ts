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
    prompt: `Extract all income rows from this UK investment platform statement.

Platform: ${classifierOutput.platform}
Column mapping: ${JSON.stringify(classifierOutput.columnMap, null, 2)}
Known quirks: ${classifierOutput.quirks.join(', ') || 'none'}

Rules:
- Extract every income row. Never drop a row.
- If a field is ambiguous, make your best guess and note it in feeType.
- grossAmount must be a positive number in GBP (strip £ signs and commas).
- paymentDate must be ISO 8601 (YYYY-MM-DD).
- platformName should be "${classifierOutput.platform}".

Statement:
${fullText}`,
  })

  return object.rows
}
