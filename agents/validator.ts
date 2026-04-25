import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from '../lib/model'
import { ValidatedRowSchema, type ParsedRow, type ValidatedRow } from '../lib/schema'

const ValidatorOutputSchema = z.object({
  rows: z.array(ValidatedRowSchema),
})

export async function validate(rows: ParsedRow[]): Promise<ValidatedRow[]> {
  if (rows.length === 0) return []

  const { object } = await generateObject({
    model: getModel(),
    schema: ValidatorOutputSchema,
    prompt: `Assign a confidence score (0.0 to 1.0) to each extracted row from a UK investment platform statement.

Score criteria:
- Field completeness: all 6 fields present and non-empty (+0.2 each)
- grossAmount plausibility: positive number in range £0.01–£1,000,000 (+0.2)
- paymentDate parseable as a valid date (+0.2)
- clientName looks like a real person or entity name (+0.2)
- planNumber is alphanumeric and non-empty (+0.2)

Set flagged: true if confidence < 0.80.

Rows to validate:
${JSON.stringify(rows, null, 2)}`,
  })

  return object.rows
}
