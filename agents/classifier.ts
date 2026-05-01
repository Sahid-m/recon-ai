import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from '../lib/model'

const ClassifierOutputSchema = z.object({
  platform: z.string().describe('Platform name, e.g. Quilter, Transact, Fidelity, AJ Bell, Aegon, Aviva, Hubwise, Nucleus, Parmenion, or Unknown'),
  quirks: z.array(z.string()).describe('Known quirks, e.g. two-tab-split, quarterly-cycle, date-mismatch'),
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
    prompt: `You are an expert at parsing UK investment platform income/remuneration statements.

Analyse this statement and identify:
1. The platform name
2. Any known quirks that will affect parsing
3. Which column contains each field — use column letters (A, B, C…) if no headers, or the exact header name if present

## Platform recognition guide

### Quilter
- Identifiers: "Quilter", "QU-" plan numbers, "Remuneration Statement", "Remuneration Report", "Paid Report"
- Quirks:
  - "two-tab-split": pension (CIB, CRA) and non-pension (ISA, CIA) are in separate sheets — merge both
  - "vat-inclusive-fees": fee rates entered as VAT-inclusive; VAT-registered firms may show higher gross
  - Three document types: Remuneration Statement (advance), Remuneration Report (retrospective), Paid Report (confirmed-paid only)
  - Columns often: Client Name, Plan Number, Fee Type, Gross Amount, Payment Date

### Transact
- Identifiers: "Transact", "TR-" plan numbers, "Integrafin", transaction codes
- Quirks:
  - "transaction-codes": 200+ numeric/alphanumeric transaction codes that change over time — map description not code
  - "income-feed-live": live income API available since May 2024
  - Fee deduction date = payment date on Transact (unlike Fidelity)

### Fidelity
- Identifiers: "Fidelity", "FI-" plan numbers, "eRemunerations", "AdviserOngoingFee", "Fidelity Adviser Solutions"
- Quirks:
  - "date-mismatch": fee deduction date ≠ statement date — use the deduction/payment date column, not the statement date
  - "adviser-ongoing-fee": AdviserOngoingFee field may be % or monetary — treat as monetary if > 1
  - "valuations-only-feed": income data arrives as file export, not live API

### AJ Bell
- Identifiers: "AJ Bell", "AJB-" or "AJ-" plan numbers, "Investcentre", "YouInvest"
- Quirks:
  - "csv-and-api": both CSV export and direct API available
  - Amount column may be labelled "Net Charge (£)" or "Amount Paid"

### Aegon
- Identifiers: "Aegon", "AE-" or "ARC-" plan numbers, "Aegon Platform", "Aegon Retirement Choices", "ARC"
- Quirks:
  - "two-integrations": Aegon Platform and ARC (Aegon Retirement Choices) are separate systems with separate Intelliflo integrations
  - "origo-xml": native format is Criterion/Origo XML; CSV exports may lose some fields
  - "arc-pension": ARC plans are pension-only; Aegon Platform is broader

### Aviva
- Identifiers: "Aviva", "AV-" plan numbers, "Aviva Platform", "MyAviva"
- Quirks:
  - "no-income-feed": Aviva has no live income API — statements arrive as file exports only
  - "valuations-finio": valuations come via FINIO middleware; income is manual
  - Amount column may include VAT breakdown separately

### Hubwise
- Identifiers: "Hubwise", "HW-" plan numbers, "SS&C Hubwise", "Whitman"
- Quirks:
  - "no-income-feed": no live income feed confirmed
  - "finio-valuations-only": connected via FINIO for valuations only
  - Often used as white-label by smaller networks — firm name may appear in header, not "Hubwise"

### Nucleus
- Identifiers: "Nucleus", "Nucleus Financial", "NUC-" plan numbers
- Quirks:
  - "direct-api": direct API integration with income feed available
  - "criterion-xml": follows Criterion/Origo standard for remuneration data

### Parmenion
- Identifiers: "Parmenion", "PAR-" plan numbers
- Quirks:
  - "daily-bulk": delivers daily bulk valuations + income via direct API
  - "direct-api": direct API integration with income feed

## Statement preview:
${preview}`,
  })

  return object
}
