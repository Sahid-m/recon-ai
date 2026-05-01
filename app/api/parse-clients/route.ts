import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { convertFile } from '../../../lib/converters'
import { getModel } from '../../../lib/model'

export const runtime = 'nodejs'
export const maxDuration = 60

const ClientSchema = z.object({
  name: z.string(),
  clientId: z.string().default(''),
  planNumber: z.string().default(''),
  platform: z.string().default(''),
  expectedMonthlyFee: z.number().default(0),
})

const OutputSchema = z.object({
  clients: z.array(ClientSchema),
})

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let sheets: Record<string, string>
  try {
    const converted = await convertFile(file)
    sheets = converted.sheets
  } catch (e) {
    return NextResponse.json({ error: `Could not read file: ${e}` }, { status: 400 })
  }

  const fullText = Object.entries(sheets)
    .map(([name, csv]) => `=== Sheet: ${name} ===\n${csv}`)
    .join('\n\n')

  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: OutputSchema,
      prompt: `Extract a list of financial advisory clients from this spreadsheet or CSV data.

The file may use any column naming convention — your job is to identify what each column represents regardless of its label.

For each client record extract:
- name: the client's full name (required — skip rows with no recognisable name)
- clientId: any client reference or ID number (leave blank if not present)
- planNumber: any plan, policy, account, or portfolio reference number (leave blank if not present)
- platform: any investment platform or provider name (leave blank if not present)
- expectedMonthlyFee: the expected monthly adviser fee in GBP as a plain number — if given annually divide by 12, if quarterly divide by 3, strip £ and commas (default 0 if not present)

Rules:
- Skip header rows, totals rows, blank rows, and metadata rows
- Only include rows that represent actual client records
- If a column clearly maps to one of the above fields, extract it even if the label is unusual
- If the fee is annual, convert to monthly by dividing by 12

Data:
${fullText}`,
    })

    return NextResponse.json({ clients: object.clients, count: object.clients.length })
  } catch (e) {
    console.error('parse-clients AI error:', e)
    return NextResponse.json({ error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
