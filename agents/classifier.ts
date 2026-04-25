import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from '../lib/model'

const ClassifierOutputSchema = z.object({
  platform: z.string().describe('Platform name, e.g. Quilter, Transact, Fidelity, or Unknown'),
  quirks: z.array(z.string()).describe('Known quirks, e.g. two-tab-split, quarterly-cycle'),
  columnMap: z.object({
    clientName: z.string().describe('Column letter or header name for client name'),
    planNumber: z.string().describe('Column letter or header name for plan/account number'),
    feeType: z.string().describe('Column letter or header name for fee type'),
    grossAmount: z.string().describe('Column letter or header name for gross amount'),
    paymentDate: z.string().describe('Column letter or header name for payment date'),
  }),
})

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>

export async function classify(sheets: Record<string, string>): Promise<ClassifierOutput> {
  const preview = Object.entries(sheets)
    .map(([name, csv]) => `=== Sheet: ${name} ===\n${csv.split('\n').slice(0, 50).join('\n')}`)
    .join('\n\n')

  const { object } = await generateObject({
    model: getModel(),
    schema: ClassifierOutputSchema,
    prompt: `You are an expert at parsing UK investment platform income statements.

Analyse this statement and identify:
1. The platform name (Quilter, Transact, Fidelity, AJ Bell, Aegon, or Unknown)
2. Any known quirks (e.g. "two-tab-split" for Quilter pension/non-pension, "quarterly-cycle", "200-transaction-codes")
3. Which column contains each field. Use column letters (A, B, C...) if the file has no headers, or the exact header name if present.

Statement preview:
${preview}`,
  })

  return object
}
