# Recon AI

> **AI-powered income reconciliation for UK IFA firms.**
> Forward a platform statement to one email address. Get a full reconciliation report back in under 60 seconds.

Built at HackLondon 2026.

---

## The Problem

Every UK IFA (Independent Financial Adviser) firm earns income through adviser charges and trail commissions paid by investment platforms (Quilter, Transact, Fidelity, AJ Bell, Aegon, etc.). Every month each platform sends a statement — in its own format, on its own schedule, with its own column names.

The firm then has to:
1. Collect statements from 3–10 platforms
2. Re-key or OCR each one manually
3. Match every line item to the right client in their back-office
4. Find discrepancies and chase the platform
5. Post confirmed income to their ledger

**IFA Dataflow** charges £300/month for a 24-hour manual turnaround with no anomaly detection. We do it in 40 seconds, with AI anomaly explanations, for the same price.

---

## How It Works

```
Adviser → forwards statement to smithwealth@readmedb.com
              ↓
Resend receives email → fires webhook → POST /api/email
              ↓
Attachment fetched → convert (xlsx/csv/pdf) → classify platform
              ↓
AI parser extracts rows: client name, plan number, fee type, amount, date
              ↓
Validator scores each row confidence (0–1), flags < 80%
              ↓
Fuzzy matcher reconciles against firm's client list
              ↓
AI generates plain-English anomaly explanation
              ↓
Report saved to ReadmeDB (persistent markdown)
              ↓
Resend sends HTML reply with summary + attached .md report
```

---

## Architecture

```
App/
├── app/
│   ├── page.tsx                  # Root — redirects to /onboarding or /dashboard
│   ├── onboarding/page.tsx       # 3-step firm setup (name → clients → email address)
│   ├── dashboard/page.tsx        # Main dashboard — reconciliation results + history
│   ├── chat/page.tsx             # AI chat interface — upload statements, ask questions
│   ├── admin/page.tsx            # Email inbox admin — live processing timeline
│   ├── results/page.tsx          # Detailed reconciliation results view
│   └── api/
│       ├── email/route.ts        # Resend inbound webhook handler (main pipeline)
│       ├── agent-chat/route.ts   # Chat agent with ReadmeDB tools (SSE streaming)
│       ├── reconcile/route.ts    # Manual reconcile endpoint (used by chat/upload)
│       ├── parse-statement/      # Statement parsing endpoint
│       ├── firm-history/         # Fetch firm's ReadmeDB markdown file
│       ├── seed-firm/            # Write/update firm + clients in ReadmeDB
│       └── admin/emails/         # Fetch email processing log from ReadmeDB
│
├── agents/
│   ├── classifier.ts             # Identifies platform + column mapping from sheet headers
│   ├── parser.ts                 # Extracts structured rows using AI (generateObject)
│   ├── validator.ts              # Scores each parsed row 0–1 confidence
│   └── orchestrator.ts           # End-to-end pipeline coordinator
│
├── lib/
│   ├── schema.ts                 # Zod schemas: ParsedRow, ValidatedRow
│   ├── reconcile.ts              # Fuzzy matching engine + toMarkdownReport()
│   ├── converters.ts             # xlsx/csv/pdf → { sheets: Record<string, string> }
│   ├── readmedb.ts               # ReadmeDB CRUD (rdbRead/Write/Append/Delete/List)
│   └── model.ts                  # AI model factory (OpenAI / Anthropic from env)
│
├── scripts/
│   ├── generate-hartley-data.mjs # Generates demo client list + statement for testing
│   └── generate-demo-data.mjs    # Generates larger multi-platform demo data
│
└── public/
    ├── hartley-partners-clients.xlsx   # Demo client list (10 clients, Quilter)
    ├── quilter-hartley-oct-2024.xlsx   # Demo statement with intentional anomalies
    └── demo-statement.xlsx             # Larger 120-row multi-platform statement
```

---

## Key Components

### Classifier (`agents/classifier.ts`)
Uses `generateObject` to identify the platform and map column names from raw sheet headers. Handles Quilter's two-tab pension/non-pension split, Transact's 200+ transaction codes, Fidelity PDFs, and AJ Bell CSVs with no pre-built templates.

**Output:**
```ts
{
  platform: 'Quilter',
  quirks: ['two-tab-split'],
  columnMap: {
    clientName: 'Client Name',
    planNumber: 'Plan Number',
    feeType: 'Fee Type',
    grossAmount: 'Gross Amount',
    paymentDate: 'Payment Date'
  }
}
```

### Parser (`agents/parser.ts`)
Uses `generateObject` with the classifier's column map to extract structured rows from raw sheet text. Handles merged cells, multi-row headers, and platform-specific quirks.

### Validator (`agents/validator.ts`)
Scores each parsed row 0.0–1.0 based on field completeness, amount plausibility, date validity, and name realism. Flags rows below 80% for human review.

### Reconcile Engine (`lib/reconcile.ts`)
Pure TypeScript fuzzy matcher. No AI — deterministic and fast.

**Matching tiers:**
| Tier | Threshold | Action |
|---|---|---|
| ✅ Auto | score ≥ 0.95 | Done, no review needed |
| 🟡 Suggested | 0.70–0.95 | One-click confirm |
| 🔴 Unmatched | < 0.70 | Human review required |

**Scoring formula:**
- Plan number exact match → 1.0
- Plan number partial/suffix match → 0.7–0.85
- Combined with name token overlap score
- Weighted: plan 60%, name 40%

### ReadmeDB (`lib/readmedb.ts`)
Persistent markdown file store. One `.md` file per firm, stored at `https://app.readmedb.com`. Used for:
- Firm client list (embedded as `json clients` code block)
- Reconciliation history (appended per run)
- Email processing log (`_email-log.json`)

**API:**
```ts
rdbRead(filename)           // GET file contents
rdbWrite(filename, content) // PUT/create file
rdbAppend(filename, text)   // Append to existing file
rdbDelete(filename)         // DELETE file
rdbList()                   // List all files
appendReconciliationToFirm(firmName, entry)  // Append formatted recon report
```

### Email Pipeline (`app/api/email/route.ts`)
Handles Resend `email.received` webhook events.

**Flow:**
1. Verify webhook signature (svix)
2. Extract attachment metadata from event payload
3. Fetch attachment via `resend.emails.receiving.attachments.get()` (with retry — Resend indexes asynchronously)
4. Download attachment via pre-signed `download_url`
5. Run classify → parse → validate → reconcile pipeline
6. Generate AI anomaly explanation
7. Save report to ReadmeDB
8. Send HTML reply via Resend with `.md` attachment
9. Log all steps to `_email-log.json` in ReadmeDB

### Chat Agent (`app/api/agent-chat/route.ts`)
SSE-streaming agent with tools:
- `parse_statement` — parse uploaded file
- `run_reconciliation` — reconcile parsed rows against client list
- `explain_anomaly` — AI explanation of a flagged row
- `list_readmedb_files` — list all firm files
- `read_readmedb_file` — read a specific file
- `write_readmedb_file` — write/update a file
- `delete_readmedb_file` — delete a file
- `save_to_readmedb` — append reconciliation to firm history

### Admin Page (`app/admin/page.tsx`)
Real-time email inbox view. Polls `/api/admin/emails` every 10s. Shows:
- All inbound emails with status badges
- Step-by-step processing timeline per email
- £ summary cards (expected / received / gap)
- Match tier breakdown
- AI anomaly analysis
- Full error detail on failures

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                    INBOUND EMAIL                     │
│  adviser@firm.com → hartley-partners@readmedb.com   │
└─────────────────────┬───────────────────────────────┘
                      │ Resend webhook
                      ▼
┌─────────────────────────────────────────────────────┐
│               POST /api/email                        │
│  1. Verify signature (svix)                          │
│  2. Fetch attachment (retry up to 5x)                │
│  3. Firm lookup from ReadmeDB by slug                │
└──────┬──────────────────────────┬───────────────────┘
       │                          │
       ▼                          ▼
┌─────────────┐          ┌────────────────┐
│  Converter  │          │    ReadmeDB    │
│ xlsx→sheets │          │  firm clients  │
└──────┬──────┘          └───────┬────────┘
       │                         │
       ▼                         │
┌─────────────┐                  │
│ Classifier  │ (GPT-4.1)        │
│  platform   │                  │
│  column map │                  │
└──────┬──────┘                  │
       ▼                         │
┌─────────────┐                  │
│   Parser    │ (GPT-4.1)        │
│  rows[]     │                  │
└──────┬──────┘                  │
       ▼                         │
┌─────────────┐                  │
│  Validator  │ (GPT-4.1)        │
│  scored     │                  │
└──────┬──────┘                  │
       │                         │
       └────────────┬────────────┘
                    ▼
          ┌──────────────────┐
          │  Reconcile Engine │ (pure TS, no AI)
          │  fuzzy matching   │
          │  auto/suggested/  │
          │  unmatched tiers  │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │   AI Anomaly     │ (GPT-4.1)
          │   Explanation    │
          └────────┬─────────┘
                   │
          ┌────────┴────────────────────┐
          │                             │
          ▼                             ▼
  ┌──────────────┐              ┌──────────────┐
  │   ReadmeDB   │              │    Resend    │
  │  firm.md     │              │  HTML reply  │
  │  _email-log  │              │  + .md report│
  └──────────────┘              └──────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI | OpenAI GPT-4.1 via Vercel AI SDK v6 |
| Email inbound | Resend (`email.received` webhook) |
| Email outbound | Resend SDK |
| Persistent storage | ReadmeDB (markdown file store) |
| File parsing | `xlsx` (Excel/CSV), `pdf-parse` (PDF) |
| Schema validation | Zod |
| Styling | Tailwind CSS v4 |
| Testing | Vitest |
| Language | TypeScript 5 |

---

## Environment Variables

```env
# AI
AI_PROVIDER=openai              # openai | anthropic
AI_MODEL=gpt-4.1
OPENAI_API_KEY=sk-...

# Storage
READMEDB_API_KEY=rdb_...

# Email
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
INBOUND_DOMAIN=readmedb.com
```

---

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` → completes onboarding → go to `/dashboard`.

### Testing email end-to-end (local)

1. Start ngrok: `npx ngrok http 3000`
2. Set Resend webhook URL to `https://xxxx.ngrok.io/api/email`, event: `email.received`
3. Complete onboarding at `localhost:3000` (creates firm in ReadmeDB)
4. Click **"↑ Sync clients to ReadmeDB"** on dashboard to confirm sync
5. Email `yourfirm@readmedb.com` with an XLS/CSV attached
6. Watch `/admin` for live processing steps

### Demo data

```bash
node scripts/generate-hartley-data.mjs
```

Generates:
- `public/hartley-partners-clients.xlsx` — 10 Quilter clients
- `public/quilter-hartley-oct-2024.xlsx` — statement with intentional anomalies:
  - 6 auto-matched rows
  - 1 fuzzy match (name abbreviated, plan off by 1 digit)
  - 1 unmatched (unknown client)
  - 2 missing clients (zero income month)
  - 1 short payment (£290 vs £340 expected)

---

## Pages

| Route | Description |
|---|---|
| `/` | Redirects based on localStorage |
| `/onboarding` | 3-step setup: firm name → import clients → get email address |
| `/dashboard` | Reconciliation results, firm history, email address, sync button |
| `/chat` | AI chat agent — upload statements, query history, ReadmeDB tools |
| `/admin` | Email inbox — live processing timeline, error detail, match stats |
| `/results` | Detailed per-row reconciliation view |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/email` | POST | Resend inbound webhook — full reconciliation pipeline |
| `/api/agent-chat` | POST | SSE streaming chat agent |
| `/api/reconcile` | POST | Manual reconcile (used by chat UI) |
| `/api/parse-statement` | POST | Parse a statement file |
| `/api/firm-history` | GET | Fetch firm's ReadmeDB history file |
| `/api/seed-firm` | POST | Write/update firm + clients in ReadmeDB |
| `/api/admin/emails` | GET | Fetch `_email-log.json` from ReadmeDB |

---

## Features Implemented

- [x] **Feature 1** — Upload any provider statement (XLS, XLSX, CSV, PDF). AI reads cold — no templates.
- [x] **Feature 2** — Income reconciliation + report. Fuzzy matching, 3-tier system, AI anomaly explanation.
- [x] **Feature 3** — Email in, report out. Forward a statement, get a reply in <60s.
- [x] **Feature 4** — Onboarding. CRM simulation + Excel import. Under 5 minutes.
- [ ] **Feature 5** — Transact live API connection (planned).

---

## Platform Support

| Platform | Format | Status |
|---|---|---|
| Quilter | XLS (2-tab pension split) | ✅ Tested |
| Transact | CSV / JSON | ✅ Parser ready |
| Fidelity | PDF | ✅ Parser ready |
| AJ Bell | CSV | ✅ Parser ready |
| Aegon | XML (Criterion) | 🔲 Planned |

---

*HackLondon 2026 — Built in ~9 hours*
