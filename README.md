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

**IFA Dataflow** charges £300/month for a 24-hour manual turnaround with no anomaly detection. We do it in 40 seconds, with AI anomaly explanations.

---

## How It Works

```
Adviser → forwards statement to smithwealth@readmedb.com
              ↓
Resend receives email → fires webhook → POST /api/email
              ↓
Attachment fetched (with retry) → convert (xlsx/csv/pdf) → classify platform
              ↓
AI parser extracts rows: client name, plan number, fee type, amount, date
              ↓
Validator scores each row confidence (0–1), flags < 80%
              ↓
Fuzzy matcher reconciles against firm's client list from ReadmeDB
              ↓
Charging-without-service flag: clients charged with no review for 12+ months
              ↓
AI generates plain-English anomaly explanation
              ↓
Report saved to ReadmeDB (persistent markdown per firm)
              ↓
Resend sends HTML reply + .md report attached
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with product overview |
| `/onboarding` | 3-step setup: firm name → import clients → get email address |
| `/dashboard` | Reconciliation results, history, CWS flags, Transact live badge |
| `/chat` | AI chat agent — full history-aware, upload statements, ReadmeDB tools |
| `/admin` | Email inbox — live processing timeline, step-by-step detail |
| `/results` | Per-row reconciliation table with confidence scores and filters |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/email` | POST | Resend inbound webhook — full reconciliation pipeline |
| `/api/agent-chat` | POST | SSE streaming chat agent with tools |
| `/api/chat` | POST | File upload parse pipeline (SSE) |
| `/api/reconcile` | POST | Manual reconcile endpoint |
| `/api/seed-firm` | POST | Write/update firm + clients in ReadmeDB |
| `/api/firm-history` | GET | Fetch firm's ReadmeDB markdown file |
| `/api/admin/emails` | GET | Fetch `_email-log.json` from ReadmeDB |
| `/api/transact-pull` | POST | Mock Transact live API pull |

---

## Architecture

```
App/
├── app/
│   ├── page.tsx                  # Landing page (YC-style, white)
│   ├── onboarding/page.tsx       # 3-step firm setup — seeds ReadmeDB on client load
│   ├── dashboard/page.tsx        # Main dashboard — real data from ReadmeDB history
│   ├── chat/page.tsx             # AI chat — Markdown render, email history context
│   ├── admin/page.tsx            # Email inbox admin — live polling, step timeline
│   ├── results/page.tsx          # Per-row results table with confidence filters
│   └── api/
│       ├── email/route.ts        # Resend webhook (main pipeline)
│       ├── agent-chat/route.ts   # Chat agent — SSE, ReadmeDB + email log tools
│       ├── chat/route.ts         # File parse pipeline — SSE
│       ├── reconcile/route.ts    # Manual reconcile
│       ├── seed-firm/route.ts    # Upsert firm clients in ReadmeDB
│       ├── firm-history/         # Fetch firm ReadmeDB file
│       ├── transact-pull/        # Mock Transact API
│       └── admin/emails/         # Email log reader
│
├── agents/
│   ├── classifier.ts             # Platform + column mapping (generateObject)
│   ├── parser.ts                 # Row extraction (generateObject)
│   └── validator.ts              # Confidence scoring (generateObject)
│
├── lib/
│   ├── schema.ts                 # Zod schemas: ParsedRow, ValidatedRow
│   ├── reconcile.ts              # Fuzzy matching + CWS flag + markdown report
│   ├── converters.ts             # xlsx/csv/pdf → { sheets: Record<string, string> }
│   ├── readmedb.ts               # ReadmeDB CRUD (read/write/append/delete/list)
│   ├── ratelimit.ts              # In-process sliding-window rate limiter
│   └── model.ts                  # AI model factory (OpenAI / Anthropic)
│
├── scripts/
│   └── generate-demo-realistic.mjs  # Generates Meridian Wealth demo files (42 clients)
│
└── public/demo/
    ├── meridian-wealth-clients.xlsx      # 42 clients, 3 platforms, lastReviewDate set
    ├── quilter-meridian-oct-2024.xlsx    # 21 rows — anomalies baked in
    ├── transact-meridian-oct-2024.xlsx   # 13 rows — missing client, wrong amount
    └── fidelity-meridian-oct-2024.xlsx   # 8 rows — wrong plan number
```

---

## Key Components

### Classifier (`agents/classifier.ts`)
Uses `generateObject` to identify platform and map column names cold. Handles Quilter's two-tab pension/non-pension split, Transact's 200+ transaction codes, Fidelity's `Investor Name` / `Net Amount` columns, AJ Bell CSVs.

### Parser (`agents/parser.ts`)
Extracts structured rows using the classifier's column map. Handles `Net Amount` → `grossAmount`, `Policy Number` → `planNumber`, `Transaction Date` → `paymentDate`, missing fields defaulted rather than dropped.

### Validator (`agents/validator.ts`)
Scores each parsed row 0.0–1.0. Flags below 80% for human review. Never silently accepts low-confidence rows.

### Reconcile Engine (`lib/reconcile.ts`)
Pure TypeScript fuzzy matcher — no AI, deterministic and fast.

| Tier | Threshold | Action |
|---|---|---|
| ✅ Auto | score ≥ 0.85 | Done |
| 🟡 Suggested | 0.60–0.85 | Review |
| 🔴 Unmatched | < 0.60 | Human required |

Scoring: plan number 70% weight, client name token overlap 30%.

**Charging-without-service flag:** Any client with collected fees but no `lastReviewDate` within 12 months is flagged. The £426m SJP compliance problem, caught automatically.

### Email Pipeline (`app/api/email/route.ts`)
Full Resend `email.received` webhook handler:
1. Verify svix signature
2. Find all spreadsheet attachments
3. Fetch each via `resend.emails.receiving.attachments.get()` — up to 5 retries with exponential backoff (Resend indexes asynchronously)
4. Firm lookup from ReadmeDB by slug — replies with onboarding instructions if unknown
5. Classify → parse → validate → reconcile each attachment
6. Compute `totalExpected` from all clients on the processed platforms (not just matched rows)
7. Flag charging-without-service
8. AI anomaly explanation
9. Save markdown report to ReadmeDB, log to `_email-log.json`
10. Send HTML reply + `.md` attachment via Resend

Rate limited: 10 emails per hour per sender.

### Chat Agent (`app/api/agent-chat/route.ts`)
SSE-streaming agent. Pre-loads firm history and last 20 email runs into system prompt on every request — so it answers "what happened last month?" without a tool call.

**Tools:**
- `get_email_log` — full structured log with per-step details
- `get_firm_history` — full ReadmeDB markdown file
- `reconcile_statement` — reconcile session rows against client list
- `get_client_list` — list clients with fees and platforms
- `get_parsed_rows` — rows from current upload session
- `explain_anomaly` — AI explanation of any anomaly
- `list_readmedb_files` / `read_readmedb_file` / `write_readmedb_file` / `delete_readmedb_file`
- `save_to_readmedb` — append notes to firm history

Rate limited: 20 requests per minute per IP.

### ReadmeDB (`lib/readmedb.ts`)
One `.md` file per firm. Stores client list as a `json clients` code block + appended reconciliation reports. Also stores `_email-log.json` as a shared log.

### Onboarding (`app/onboarding/page.tsx`)
Seeds ReadmeDB the moment clients are loaded (not on "finish") — so the email address is live immediately and emails sent before completing step 3 still work.

---

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    INBOUND EMAIL                     │
│  adviser@firm.com → smithwealth@readmedb.com        │
└─────────────────────┬───────────────────────────────┘
                      │ Resend webhook
                      ▼
              POST /api/email
              ├── Verify signature
              ├── Firm lookup (ReadmeDB)
              ├── For each attachment:
              │   ├── Download (retry ×5)
              │   ├── Convert → classify → parse → validate
              │   └── Collect rows
              ├── Reconcile (all rows × all clients)
              ├── Flag CWS clients
              ├── AI anomaly explanation
              ├── Save to ReadmeDB
              └── Send HTML reply + .md report
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| AI | OpenAI GPT-4.1 via Vercel AI SDK |
| Email inbound | Resend `email.received` webhook |
| Email outbound | Resend SDK |
| Persistent storage | ReadmeDB (markdown file store) |
| File parsing | `xlsx` (Excel/CSV), `pdf-parse` (PDF) |
| Schema validation | Zod |
| Styling | Tailwind CSS |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Rate limiting | In-process sliding-window (no Redis needed) |
| Language | TypeScript |

---

## Environment Variables

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4.1
OPENAI_API_KEY=sk-...

READMEDB_API_KEY=rdb_...

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

Open `http://localhost:3000` → onboarding → dashboard.

### Testing email end-to-end (local)

1. `npx ngrok http 3000`
2. Set Resend webhook to `https://xxxx.ngrok.io/api/email`, event: `email.received`
3. Complete onboarding — firm is seeded to ReadmeDB on client import
4. Email `yourfirm@readmedb.com` with a demo file attached
5. Watch `/admin` for live processing

### Demo data (Meridian Wealth — 42 clients)

```bash
node scripts/generate-demo-realistic.mjs
```

Generates `public/demo/`:
- `meridian-wealth-clients.xlsx` — 42 clients across Quilter, Transact, Fidelity with `Last Review Date`
- `quilter-meridian-oct-2024.xlsx` — 21 rows, 1 fuzzy match, 1 unmatched, 1 wrong amount
- `transact-meridian-oct-2024.xlsx` — 13 rows, 1 missing client (Oliver Stratford), 1 wrong amount
- `fidelity-meridian-oct-2024.xlsx` — 8 rows, 1 wrong plan number

**Intentional anomalies for demo:**
- Derek Fotheringay — unknown client, unmatched
- H Dunmore → Harriet Dunmore — fuzzy/suggested match
- George Thornbury — paid £490, expected £550
- Oliver Stratford — no payment received (missing)
- Natasha Hollingsworth — paid £390, expected £465
- Yvonne Stafford — wrong plan number (FI-330509 vs FI-330508)
- 4 CWS flags: Patricia Sinclair, Victoria Pemberton, Ian Crompton, Vivienne Caldwell

---

## Features Implemented

- [x] **Feature 1** — Upload any statement (XLS, XLSX, CSV, PDF). AI reads cold.
- [x] **Feature 2** — Reconciliation engine. 3-tier fuzzy matching, gap calc, AI anomaly explanation, CWS flag.
- [x] **Feature 3** — Email in, report out. Multi-attachment batch, HTML reply + .md attachment.
- [x] **Feature 4** — Onboarding. CRM simulation, Excel import, instant ReadmeDB seed.
- [x] **Feature 5** — Transact live API mock. Live badge, pull button, simulated income data.
- [x] **Admin page** — Email processing timeline, step-by-step detail, live polling.
- [x] **Chat agent** — History-aware, email log access, ReadmeDB tools, Markdown rendering.
- [x] **Rate limiting** — Chat (20/min), parse (10/min), email (10/hr per sender).
- [x] **Landing page** — YC-style, white, minimal.

---

## Platform Support

| Platform | Format | Notes |
|---|---|---|
| Quilter | XLS (2-tab pension split) | Tested |
| Transact | CSV + REST API | Tested + live mock |
| Fidelity | PDF / XLS | `Net Amount`, `Investor Name` mapped |
| AJ Bell | CSV | Parser ready |
| Aegon | XML | Planned |

---

*HackLondon 2026 — Built in ~9 hours*
