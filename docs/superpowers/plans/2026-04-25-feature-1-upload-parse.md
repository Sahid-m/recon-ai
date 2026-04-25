# Feature 1 — Upload Any Provider Statement: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agent-based pipeline that accepts any UK investment platform statement (XLS/XLSX/CSV/PDF), converts it to text, classifies the format, extracts income rows, assigns confidence scores, and returns typed JSON — with zero template configuration.

**Architecture:** Three AI agents (Classifier → Parser → Validator) coordinated by an Orchestrator. A deterministic converter handles file-to-text before any AI call. All agents use the Vercel AI SDK so the model provider (Claude/GPT-4o) is swapped via env var.

**Tech Stack:** Next.js 14 (App Router), Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), `xlsx`, `pdf-parse`, Zod, Vitest, Tailwind CSS

---

## File Map

| File | Responsibility |
|------|---------------|
| `lib/schema.ts` | Shared Zod schemas — ParsedRow, ValidatedRow |
| `lib/model.ts` | AI model factory — reads `AI_PROVIDER` env var |
| `lib/converters.ts` | Deterministic file-to-text (xlsx, pdf-parse) |
| `agents/classifier.ts` | Agent 1: identifies platform + maps columns |
| `agents/parser.ts` | Agent 2: extracts rows using classifier output |
| `agents/validator.ts` | Agent 3: assigns confidence scores, sets flagged |
| `agents/orchestrator.ts` | Coordinates converter → classifier → parser → validator |
| `app/api/parse-statement/route.ts` | POST endpoint — validates file, calls orchestrator |
| `components/UploadZone.tsx` | Drag-and-drop file input with upload logic |
| `components/ResultsTable.tsx` | Colour-coded confidence table |
| `app/page.tsx` | Upload page |
| `app/results/page.tsx` | Results page (reads from sessionStorage) |
| `next.config.ts` | Adds `serverComponentsExternalPackages` for pdf-parse/xlsx |
| `.env.local.example` | Documents required env vars |
| `vitest.config.ts` | Vitest configuration |

---

## Task 1: Scaffold Next.js project + install dependencies

**Files:**
- Create: `package.json`, `next.config.ts`, `.env.local.example`, `vitest.config.ts`, `tsconfig.json`

- [ ] **Step 1: Scaffold the project**

```bash
cd /c/Users/sahid/Desktop/HackLondon/App
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --yes
```

Expected: Next.js project created with TypeScript, Tailwind, App Router.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic xlsx pdf-parse
```

Expected: packages added to `node_modules` with no peer dependency errors.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @types/pdf-parse
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 5: Add test script to `package.json`**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Write `next.config.ts`**

Replace the existing `next.config.ts` with:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'xlsx'],
  },
}

export default nextConfig
```

- [ ] **Step 7: Write `.env.local.example`**

```bash
# Provider: openai or anthropic
AI_PROVIDER=openai
AI_MODEL=gpt-4o
OPENAI_API_KEY=sk-...

# To switch to Anthropic:
# AI_PROVIDER=anthropic
# AI_MODEL=claude-3-5-sonnet-20241022
# ANTHROPIC_API_KEY=sk-ant-...
```

Copy to `.env.local` and fill in your real key:
```bash
cp .env.local.example .env.local
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with Vercel AI SDK and dependencies"
```

---

## Task 2: Shared schema (`lib/schema.ts`)

**Files:**
- Create: `lib/schema.ts`
- Create: `tests/lib/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ParsedRowSchema, ValidatedRowSchema } from '../../lib/schema'

describe('ParsedRowSchema', () => {
  it('accepts a valid row', () => {
    const result = ParsedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a row missing clientName', () => {
    const result = ParsedRowSchema.safeParse({
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a row with a string grossAmount', () => {
    const result = ParsedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: '150.00',
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
    })
    expect(result.success).toBe(false)
  })
})

describe('ValidatedRowSchema', () => {
  it('accepts confidence of 0.95 and flagged false', () => {
    const result = ValidatedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
      confidence: 0.95,
      flagged: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = ValidatedRowSchema.safeParse({
      clientName: 'John Smith',
      planNumber: 'QU-12345',
      feeType: 'Ongoing Adviser Charge',
      grossAmount: 150.00,
      paymentDate: '2024-10-01',
      platformName: 'Quilter',
      confidence: 1.5,
      flagged: false,
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/lib/schema.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/schema'`

- [ ] **Step 3: Write `lib/schema.ts`**

```ts
import { z } from 'zod'

export const ParsedRowSchema = z.object({
  clientName: z.string(),
  planNumber: z.string(),
  feeType: z.string(),
  grossAmount: z.number(),
  paymentDate: z.string(),
  platformName: z.string(),
})

export const ValidatedRowSchema = ParsedRowSchema.extend({
  confidence: z.number().min(0).max(1),
  flagged: z.boolean(),
})

export type ParsedRow = z.infer<typeof ParsedRowSchema>
export type ValidatedRow = z.infer<typeof ValidatedRowSchema>
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/lib/schema.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts tests/lib/schema.test.ts
git commit -m "feat: add shared Zod schemas for ParsedRow and ValidatedRow"
```

---

## Task 3: AI model factory (`lib/model.ts`)

**Files:**
- Create: `lib/model.ts`
- Create: `tests/lib/model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/model.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getModel', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns an OpenAI model by default', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai')
    vi.stubEnv('AI_MODEL', 'gpt-4o')
    const { getModel } = await import('../../lib/model')
    const model = getModel()
    expect(model).toBeDefined()
  })

  it('returns an Anthropic model when AI_PROVIDER=anthropic', async () => {
    vi.stubEnv('AI_PROVIDER', 'anthropic')
    vi.stubEnv('AI_MODEL', 'claude-3-5-sonnet-20241022')
    const { getModel } = await import('../../lib/model')
    const model = getModel()
    expect(model).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/lib/model.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/model'`

- [ ] **Step 3: Write `lib/model.ts`**

```ts
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

export function getModel() {
  const provider = process.env.AI_PROVIDER ?? 'openai'
  const modelId = process.env.AI_MODEL ?? 'gpt-4o'

  if (provider === 'anthropic') {
    return createAnthropic()(modelId)
  }
  return createOpenAI()(modelId)
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/lib/model.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/model.ts tests/lib/model.test.ts
git commit -m "feat: add AI model factory with provider switching via env var"
```

---

## Task 4: File converters (`lib/converters.ts`)

**Files:**
- Create: `lib/converters.ts`
- Create: `tests/lib/converters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/converters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { convertFile } from '../../lib/converters'

function makeXlsxFile(data: Record<string, unknown>[][]): File {
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/lib/converters.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/converters'`

- [ ] **Step 3: Write `lib/converters.ts`**

```ts
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
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return { sheets: { PDF: data.text } }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/lib/converters.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/converters.ts tests/lib/converters.test.ts
git commit -m "feat: add deterministic file converter for xlsx, csv, pdf"
```

---

## Task 5: Classifier Agent (`agents/classifier.ts`)

**Files:**
- Create: `agents/classifier.ts`
- Create: `tests/agents/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/classifier.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/agents/classifier.test.ts
```

Expected: FAIL — `Cannot find module '../../agents/classifier'`

- [ ] **Step 3: Write `agents/classifier.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/agents/classifier.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add agents/classifier.ts tests/agents/classifier.test.ts
git commit -m "feat: add Classifier agent for platform detection and column mapping"
```

---

## Task 6: Parser Agent (`agents/parser.ts`)

**Files:**
- Create: `agents/parser.ts`
- Create: `tests/agents/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/parser.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { ClassifierOutput } from '../../agents/classifier'

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      rows: [
        {
          clientName: 'John Smith',
          planNumber: 'QU-12345',
          feeType: 'Ongoing Adviser Charge',
          grossAmount: 150.00,
          paymentDate: '2024-10-01',
          platformName: 'Quilter',
        },
      ],
    },
  }),
}))

vi.mock('../../lib/model', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
}))

const mockClassifierOutput: ClassifierOutput = {
  platform: 'Quilter',
  quirks: [],
  columnMap: {
    clientName: 'A',
    planNumber: 'B',
    feeType: 'C',
    grossAmount: 'D',
    paymentDate: 'E',
  },
}

describe('parse', () => {
  it('returns an array of ParsedRows', async () => {
    const { parse } = await import('../../agents/parser')
    const rows = await parse({ Sheet1: 'A,B,C,D,E\nJohn Smith,QU-12345,OAC,150,2024-10-01' }, mockClassifierOutput)
    expect(rows).toHaveLength(1)
    expect(rows[0].clientName).toBe('John Smith')
    expect(rows[0].grossAmount).toBe(150.00)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/agents/parser.test.ts
```

Expected: FAIL — `Cannot find module '../../agents/parser'`

- [ ] **Step 3: Write `agents/parser.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/agents/parser.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add agents/parser.ts tests/agents/parser.test.ts
git commit -m "feat: add Parser agent for income row extraction"
```

---

## Task 7: Validator Agent (`agents/validator.ts`)

**Files:**
- Create: `agents/validator.ts`
- Create: `tests/agents/validator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/validator.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { ParsedRow } from '../../lib/schema'

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      rows: [
        {
          clientName: 'John Smith',
          planNumber: 'QU-12345',
          feeType: 'Ongoing Adviser Charge',
          grossAmount: 150.00,
          paymentDate: '2024-10-01',
          platformName: 'Quilter',
          confidence: 0.95,
          flagged: false,
        },
        {
          clientName: '',
          planNumber: 'QU-99999',
          feeType: 'Unknown',
          grossAmount: 0,
          paymentDate: '???',
          platformName: 'Quilter',
          confidence: 0.40,
          flagged: true,
        },
      ],
    },
  }),
}))

vi.mock('../../lib/model', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
}))

const mockRows: ParsedRow[] = [
  {
    clientName: 'John Smith',
    planNumber: 'QU-12345',
    feeType: 'Ongoing Adviser Charge',
    grossAmount: 150.00,
    paymentDate: '2024-10-01',
    platformName: 'Quilter',
  },
  {
    clientName: '',
    planNumber: 'QU-99999',
    feeType: 'Unknown',
    grossAmount: 0,
    paymentDate: '???',
    platformName: 'Quilter',
  },
]

describe('validate', () => {
  it('returns validated rows with confidence and flagged', async () => {
    const { validate } = await import('../../agents/validator')
    const result = await validate(mockRows)
    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBe(0.95)
    expect(result[0].flagged).toBe(false)
    expect(result[1].confidence).toBe(0.40)
    expect(result[1].flagged).toBe(true)
  })

  it('returns empty array for empty input without calling AI', async () => {
    const { validate } = await import('../../agents/validator')
    const result = await validate([])
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/agents/validator.test.ts
```

Expected: FAIL — `Cannot find module '../../agents/validator'`

- [ ] **Step 3: Write `agents/validator.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/agents/validator.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agents/validator.ts tests/agents/validator.test.ts
git commit -m "feat: add Validator agent for confidence scoring and row flagging"
```

---

## Task 8: Orchestrator (`agents/orchestrator.ts`)

**Files:**
- Create: `agents/orchestrator.ts`
- Create: `tests/agents/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/orchestrator.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test tests/agents/orchestrator.test.ts
```

Expected: FAIL — `Cannot find module '../../agents/orchestrator'`

- [ ] **Step 3: Write `agents/orchestrator.ts`**

```ts
import { convertFile } from '../lib/converters'
import { classify } from './classifier'
import { parse } from './parser'
import { validate } from './validator'
import type { ValidatedRow } from '../lib/schema'

export type OrchestratorResult =
  | { success: true; rows: ValidatedRow[] }
  | { success: false; error: string; rows: ValidatedRow[] }

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}

export async function orchestrate(file: File): Promise<OrchestratorResult> {
  let converted
  try {
    converted = await convertFile(file)
  } catch (err) {
    return { success: false, error: String(err), rows: [] }
  }

  let classifierOutput
  try {
    classifierOutput = await withRetry(() => classify(converted.sheets))
  } catch {
    return {
      success: false,
      error: 'Could not confidently parse this format. All rows need review.',
      rows: [],
    }
  }

  let parsedRows
  try {
    parsedRows = await withRetry(() => parse(converted.sheets, classifierOutput))
  } catch {
    return { success: false, error: 'No income rows found in this file.', rows: [] }
  }

  if (parsedRows.length === 0) {
    return { success: false, error: 'No income rows found in this file.', rows: [] }
  }

  let validatedRows
  try {
    validatedRows = await withRetry(() => validate(parsedRows))
  } catch {
    validatedRows = parsedRows.map(row => ({ ...row, confidence: 0, flagged: true }))
  }

  return { success: true, rows: validatedRows }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test tests/agents/orchestrator.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add agents/orchestrator.ts tests/agents/orchestrator.test.ts
git commit -m "feat: add Orchestrator that chains converter and all agents with retry"
```

---

## Task 9: API route (`app/api/parse-statement/route.ts`)

**Files:**
- Create: `app/api/parse-statement/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/api/parse-statement
```

- [ ] **Step 2: Write `app/api/parse-statement/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { orchestrate } from '../../../agents/orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 60

const ALLOWED_EXTENSIONS = ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 },
    )
  }

  const result = await orchestrate(file)
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Verify the route responds (manual)**

Start the dev server:
```bash
npm run dev
```

In a second terminal, run:
```bash
curl -X POST http://localhost:3000/api/parse-statement \
  -F "file=@/dev/null;filename=test.csv;type=text/csv"
```

Expected: JSON response `{"success":false,"error":"No income rows found in this file.","rows":[]}` or similar (no 500 error).

Stop the dev server (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add app/api/parse-statement/route.ts
git commit -m "feat: add parse-statement API route with file validation"
```

---

## Task 10: UploadZone component (`components/UploadZone.tsx`)

**Files:**
- Create: `components/UploadZone.tsx`

- [ ] **Step 1: Write `components/UploadZone.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  const handleFile = useCallback(
    async (file: File) => {
      setStatus('uploading')
      setErrorMessage('')

      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/parse-statement', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data.error ?? 'Something went wrong.')
          return
        }

        sessionStorage.setItem('recon-results', JSON.stringify(data))
        router.push('/results')
      } catch {
        setStatus('error')
        setErrorMessage('Upload failed. Please try again.')
      }
    },
    [router],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'
      }`}
    >
      {status === 'uploading' ? (
        <div className="space-y-2">
          <p className="text-gray-700 font-medium">Parsing statement...</p>
          <p className="text-sm text-gray-400">This may take 15–30 seconds</p>
        </div>
      ) : (
        <>
          <p className="text-lg font-medium text-gray-700">Drop your statement here</p>
          <p className="text-sm text-gray-400 mt-1">XLS, XLSX, CSV, PDF — any platform, any format</p>
          <label className="mt-5 inline-block cursor-pointer">
            <span className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Browse file
            </span>
            <input
              type="file"
              className="hidden"
              accept=".xls,.xlsx,.xlsm,.xlsb,.csv,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </label>
          {status === 'error' && (
            <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/UploadZone.tsx
git commit -m "feat: add UploadZone component with drag-and-drop and error states"
```

---

## Task 11: ResultsTable component (`components/ResultsTable.tsx`)

**Files:**
- Create: `components/ResultsTable.tsx`

- [ ] **Step 1: Write `components/ResultsTable.tsx`**

```tsx
import type { ValidatedRow } from '../lib/schema'

function badge(confidence: number) {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.7) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function label(confidence: number) {
  if (confidence >= 0.8) return 'Auto-matched'
  if (confidence >= 0.7) return 'Review'
  return 'Flagged'
}

export function ResultsTable({ rows }: { rows: ValidatedRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm p-4">No rows to display.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Client', 'Plan No.', 'Fee Type', 'Amount', 'Date', 'Platform', 'Status'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2">{row.clientName}</td>
              <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.planNumber}</td>
              <td className="px-4 py-2 text-gray-600">{row.feeType}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                £{row.grossAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2 text-gray-500">{row.paymentDate}</td>
              <td className="px-4 py-2 text-gray-600">{row.platformName}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(row.confidence)}`}>
                  {label(row.confidence)} {Math.round(row.confidence * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ResultsTable.tsx
git commit -m "feat: add ResultsTable with green/amber/red confidence colour coding"
```

---

## Task 12: Upload page (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { UploadZone } from '../components/UploadZone'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recon AI</h1>
          <p className="text-gray-500 mt-1">
            Drop any platform statement. We parse it in seconds.
          </p>
        </div>
        <UploadZone />
        <p className="text-xs text-gray-400 text-center">
          Quilter · Transact · Fidelity · AJ Bell · Aegon · and any other platform
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add upload home page"
```

---

## Task 13: Results page (`app/results/page.tsx`)

**Files:**
- Create: `app/results/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/results
```

- [ ] **Step 2: Write `app/results/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResultsTable } from '../../components/ResultsTable'
import type { ValidatedRow } from '../../lib/schema'

export default function ResultsPage() {
  const [rows, setRows] = useState<ValidatedRow[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const raw = sessionStorage.getItem('recon-results')
    if (!raw) { router.push('/'); return }
    const data = JSON.parse(raw)
    if (!data.success && data.error) setError(data.error)
    setRows(data.rows ?? [])
  }, [router])

  const total = rows.reduce((sum, r) => sum + r.grossAmount, 0)
  const autoMatched = rows.filter((r) => r.confidence >= 0.8).length
  const needsReview = rows.filter((r) => r.confidence >= 0.7 && r.confidence < 0.8).length
  const flagged = rows.filter((r) => r.confidence < 0.7).length

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation Results</h1>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:underline"
          >
            Upload another statement
          </button>
        </div>

        {error && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total rows</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4">
            <p className="text-xs text-green-600 uppercase tracking-wide">Auto-matched</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{autoMatched}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <p className="text-xs text-amber-600 uppercase tracking-wide">Needs review</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{needsReview}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-4">
            <p className="text-xs text-red-600 uppercase tracking-wide">Flagged</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{flagged}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total reconciled</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            £{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border">
          <ResultsTable rows={rows} />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/results/page.tsx
git commit -m "feat: add results page with summary stats and confidence table"
```

---

## Task 14: Full test run + smoke test

**Files:** none new

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Create a demo CSV for smoke testing**

Create `public/demo-statement.csv`:

```csv
Client Name,Plan Number,Fee Type,Gross Amount,Payment Date,Platform
John Smith,QU-12345,Ongoing Adviser Charge,150.00,01/10/2024,Quilter
Sarah Jones,QU-67890,Trail Commission,89.50,01/10/2024,Quilter
Robert Brown,QU-11111,Ongoing Adviser Charge,220.00,01/10/2024,Quilter
Emma Wilson,QU-22222,Ongoing Adviser Charge,0.00,01/10/2024,Quilter
,QU-33333,Unknown,175.00,???,Quilter
```

- [ ] **Step 4: Smoke test in browser**

1. Open `http://localhost:3000`
2. Upload `public/demo-statement.csv`
3. Verify the results page shows:
   - 5 rows total
   - At least 3 green (auto-matched)
   - Row 4 (£0.00) and row 5 (missing client/date) shown as amber or red
   - Total reconciled ≥ £634.50
4. Confirm no 500 errors in the terminal

- [ ] **Step 5: Verify model switching works**

In `.env.local`, set:
```
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...
```

Restart dev server and repeat the smoke test. Same output structure expected.

- [ ] **Step 6: Final commit**

```bash
git add public/demo-statement.csv
git commit -m "feat: add demo CSV for smoke testing Feature 1"
```
