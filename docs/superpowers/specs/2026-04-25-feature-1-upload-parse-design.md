# Feature 1 — Upload Any Provider Statement: Design Spec
**Recon AI · HackLondon 2026**  
*Date: 2026-04-25*

---

## Overview

Feature 1 is the foundation of Recon AI. It accepts any UK investment platform statement (XLS, XLSX, XLSM, XLSB, CSV, PDF), converts it to text deterministically, then runs it through a chain of AI agents that classify the format, extract income rows, and assign confidence scores. Output is a typed JSON array of validated rows, ready for Feature 2 (reconciliation).

The core promise: **no templates required**. Any format from any platform is parsed cold.

---

## Architecture

```
App/
├── app/
│   ├── page.tsx                       ← Upload UI (drag & drop zone)
│   ├── results/page.tsx               ← Parsed results table
│   └── api/
│       └── parse-statement/
│           └── route.ts               ← Entry point → calls orchestrator
├── agents/
│   ├── orchestrator.ts                ← Coordinates agent pipeline
│   ├── classifier.ts                  ← Agent 1: platform ID + column mapping
│   ├── parser.ts                      ← Agent 2: row extraction
│   └── validator.ts                   ← Agent 3: confidence scoring + flagging
├── lib/
│   ├── converters.ts                  ← Deterministic file-to-text (no AI)
│   └── schema.ts                      ← Shared Zod schemas across all agents
└── components/
    ├── UploadZone.tsx                 ← Drag & drop file input
    └── ResultsTable.tsx               ← Colour-coded confidence table
```

All agents use the **Vercel AI SDK** (`generateObject`) so the underlying model (Claude, GPT-4o, etc.) can be swapped at any time without touching agent logic.

---

## Data Flow

```
File upload (.xls / .xlsx / .csv / .pdf)
        ↓
lib/converters.ts  (deterministic, no AI)
  → Excel: every sheet → named CSV strings  { "Sheet1": "...", "Pension": "..." }
  → PDF:   pages → plain text block
  → Strips merged cells, empty header rows, hidden columns
        ↓
Classifier Agent
  Input:  named sheet bundle or text block (first ~500 lines)
  Output: {
    platform: "Quilter" | "Transact" | "Fidelity" | "Unknown",
    quirks: string[],            // e.g. ["two-tab-split", "quarterly-cycle"]
    columnMap: {                 // dynamic if platform unknown
      clientName: "Column C",
      planNumber: "Column A",
      feeType:    "Column E",
      grossAmount: "Column F",
      paymentDate: "Column D"
    }
  }
        ↓
Parser Agent
  Input:  full text + classifier output (platform + columnMap)
  Output: Row[]  { clientName, planNumber, feeType, grossAmount, paymentDate, platformName }
        ↓
Validator Agent
  Input:  Row[]
  Output: ValidatedRow[]  { ...row, confidence: number, flagged: boolean }
        ↓
API route returns ValidatedRow[] to frontend
```

---

## Shared Schema (`lib/schema.ts`)

```ts
import { z } from "zod"

export const RowSchema = z.object({
  clientName:   z.string(),
  planNumber:   z.string(),
  feeType:      z.string(),
  grossAmount:  z.number(),
  paymentDate:  z.string(),   // ISO 8601
  platformName: z.string(),
  confidence:   z.number().min(0).max(1),
  flagged:      z.boolean(),
})

export type Row = z.infer<typeof RowSchema>
```

All agents validate their output against this schema. Zod parse failure triggers one automatic retry, then returns a `LOW_CONFIDENCE` result.

---

## Agent Detail

### Classifier Agent (`agents/classifier.ts`)
- Reads the first ~500 lines of each sheet or the full text block
- If platform is recognised: applies known quirk handling (e.g. Quilter two-tab merge, Transact 200+ transaction code mapping)
- If platform is unknown: dynamically infers which column contains client names, amounts, dates, etc. — no hardcoded rules
- Sheet names inform classification (e.g. "Pension" + "Non-Pension" = Quilter pattern)

### Parser Agent (`agents/parser.ts`)
- Receives the full text and the Classifier's `columnMap`
- Extracts every income row using the mapped columns
- Never drops a row — if a field is ambiguous, it includes it with a note in `feeType`

### Validator Agent (`agents/validator.ts`)
- Assigns a confidence score (0–1) per row based on: field completeness, amount plausibility, date parsability, name format
- Sets `flagged: true` for any row with confidence < 0.80
- Never silently accepts a low-confidence row

### Orchestrator (`agents/orchestrator.ts`)
- Calls converter → classifier → parser → validator in sequence
- Each agent has one retry on timeout or schema parse failure
- Returns `ValidatedRow[]` to the API route

---

## File Format Support

| Format | Library | Notes |
|--------|---------|-------|
| `.xlsx`, `.xlsm`, `.xlsb` | `xlsx` | All sheets extracted, merged cells stripped |
| `.xls` (legacy binary) | `xlsx` | Same handling as above |
| `.csv` | `xlsx` or native parse | Single sheet, passed as-is |
| `.pdf` | `pdf-parse` | All pages concatenated to text block |

Any Excel format is supported — the Classifier handles structure discovery dynamically, so novel formats from unrecognised platforms still get parsed.

---

## Error Handling

### File validation (pre-AI)
- Max file size: 10MB — reject with clear message
- Unsupported type: reject, show accepted types list
- Corrupt/empty file: caught by converter, surfaced before any agent call

### Agent failures
- Zod parse failure or timeout: one automatic retry
- Classifier cannot map columns after retry: return all rows as `flagged: true`, show banner — *"Could not confidently parse this format. All rows need review."*
- Parser extracts zero rows: return error — *"No income rows found in this file."*

### Confidence thresholds
| Score | Colour | Meaning |
|-------|--------|---------|
| ≥ 0.80 | Green | Auto-accepted |
| 0.70–0.79 | Amber | One-click confirmation |
| < 0.70 | Red | Human review required |

---

## Out of Scope (Feature 1)

- User authentication / sessions
- Persisting results to a database
- Reconciliation against client records (Feature 2)
- Email inbound webhook (Feature 3)
- Transact live API (Feature 5)
- Error handling for concurrent uploads or network blips

---

## Success Criteria

- Any `.xls`, `.xlsx`, `.xlsm`, `.xlsb`, `.csv`, or `.pdf` from a UK platform can be uploaded and returns a structured `ValidatedRow[]`
- Unknown/novel Excel formats are parsed via dynamic column mapping — no template configuration needed
- Every row in the output has a confidence score; no row is silently dropped
- The model provider can be switched (Claude ↔ GPT-4o) by changing one env var
