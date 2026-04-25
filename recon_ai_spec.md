# Recon AI — Product Spec
### AI Income Reconciliation for UK IFA Firms
*HackLondon 2026 · Product Spec · Build Plan · YC-Style Demo Guide*

---

## The One-Line Pitch

> Forward your platform statements to one email address. We reconcile everything and send you a report. That's it.

---

## 1. The Problem

Every UK IFA firm earns money through adviser charges and trail commissions paid by investment platforms. Every month, each platform sends a statement — in its own format, on its own schedule, with its own column names and reference numbers.

The firm must then:

1. Collect statements from 3–10 platforms
2. Re-key or OCR each one manually
3. Match every line item to the right client in their back-office
4. Find discrepancies and chase the platform
5. Post confirmed income to their ledger

> *"Paper statements can be 10 pages long with 25 different income items. You total them separately — and by the time you get to the end, it doesn't balance, so you have to start again."*
> — UK IFA operations manager

| Platform | Format | Income Feed? | Key Quirk |
|---|---|---|---|
| Quilter | XLS (2 tabs) | No API | Pension & non-pension split |
| Transact | JSON / CSV | REST API (2024) | 200+ transaction codes |
| Fidelity | PDF | Valuations only | 40-page statements |
| AJ Bell | CSV | Direct API | Most accessible |
| Aegon | XML (Criterion) | Via Origo Hub | Two separate integrations |

---

## 2. Target Customer

**Individual IFA firm.** 1–100 advisers. Using Intelliflo, Xplan, or Excel. Receiving statements from 3–10 platforms monthly. Currently reconciling manually or outsourcing to IFA Dataflow at 24-hour turnaround with no anomaly detection.

**Their monthly reality**
- Hours re-keying or waiting for IFA Dataflow
- Missed income they're not aware of
- No audit trail for FCA purposes
- One staff member's holiday breaks the whole process
- Charging clients for services not delivered (SJP: £426m remediation)

**What they want**
- Fast reconciliation — same day
- Know immediately if a payment is wrong
- Plain-English explanation, not a spreadsheet
- Works with platforms they already use
- Requires zero behaviour change to start

> Networks are the Series A story, not today. Every firm we sign is a potential AR firm inside a network — that's the enterprise upsell.

---

## 3. Feature Spec

### Feature 1 — Upload Any Provider Statement
*Any platform. Any format. No templates required.*

Drop in an XLS, XLSX, CSV or PDF from any UK platform. The AI reads it cold — no pre-built format configuration needed.

**Output per upload:**
- Client name, Plan/account number, Fee type
- Gross amount, Payment date, Platform name
- Confidence score per row — rows under 80% flagged for human review, never silently accepted

**Platform quirks handled automatically:**
Quilter's two-tab pension/non-pension split treated as one job. Transact's 200+ transaction codes mapped to fee types. Multi-page Fidelity PDFs parsed in full. No manual intervention.

---

### Feature 2 — Income Reconciliation + Report
*Expected vs received. Explained in plain English.*

Match extracted statement data against the firm's client records (imported from CRM or Excel). Identify every gap between what should have arrived and what did.

**Matching tiers:**
- ✅ Auto-matched (95%+ confidence) — done, no action needed
- 🟡 Suggested match (70–95%) — shown for one-click confirmation
- 🔴 Unmatched / flagged (<70%) — human review required

**Report contains:**
- Total expected income vs total received — £ gap and % variance
- Count and total of auto-matched, suggested, and unmatched items
- Plain-English AI explanation per anomaly — e.g. *"14 accounts show zero income. Likely cause: Quilter quarterly cycle — next payment expected 15 Nov."*
- Charging-without-service flag: any client with ongoing fees collected but no review on record for 12+ months

---

### Feature 3 — Email In, Report Out
*Forward a statement. Get a report back. No login needed.*

Every firm gets a unique inbound email address after onboarding — e.g. `smithwealth@recon.ai`. They forward any platform statement email to it. The AI processes the attachment and replies with the completed reconciliation report within minutes.

**Email flow:**
1. Platform sends statement to adviser
2. Adviser forwards to `smithwealth@recon.ai`
3. System receives email, extracts attachment (XLS / PDF / CSV)
4. Runs parse + match against their imported client records
5. Replies: *"Quilter statement processed. £482,310 reconciled. 2 anomalies found. Report attached."*

Multiple attachments in one forwarded email are all processed as a single job. One reply, one combined report.

**Technical note:** Inbound email webhook via Postmark or Mailgun. One endpoint. ~1 hour of work once the parsing pipeline exists.

---

### Feature 4 — Onboarding: Import Clients, Get Started
*Under 5 minutes from sign-up to first reconciliation.*

| Step | What happens | Time |
|---|---|---|
| 1 — Setup | Firm name, number of advisers, which platforms they use (checkbox list) | 60 sec |
| 2 — Import clients | Connect Intelliflo via OAuth (read-only) OR upload Excel template: Name, Client ID, Plan No., Platform, Expected Monthly Fee | 2 min |
| 3 — Get email address | System generates `smithwealth@recon.ai`. Instruction: forward your next statement here. Done. | 10 sec |

> **Why the Excel fallback matters:** Most small IFA firms don't have Intelliflo, or won't grant OAuth access on day one. The Excel template is the zero-friction path that ensures no one hits a dead end during onboarding.

---

### Feature 5 — Transact Live API Connection
*One platform. Fully automatic. No statement forwarding needed.*

Transact is the right choice — public REST API documented on Postman, remuneration endpoint confirmed live since May 2024, JSON format, no partnership required.

Optional during onboarding: enter Transact adviser credentials. From that point, Transact income pulls automatically on a schedule. No statement forwarding needed for those clients. Shows a green **"Live"** badge in the dashboard instead of "Uploaded."

**The pitch line this enables:**
> *"For platforms with APIs, it's 100% automatic. For the other 22 platforms with no API, you just forward the email. Same result either way."*

---

## 4. Build Plan (8–9 Hours)

### Priority order

| Priority | Feature | Build or fake? | Why |
|---|---|---|---|
| 🥇 1 | File upload + Claude API parsing → structured JSON | **Build for real** | Everything else depends on this |
| 🥈 2 | Onboarding UI + client Excel import | **Build lightweight** | Makes it feel like a product, not a script |
| 🥉 3 | Matching logic + reconciliation report + anomaly explanation | **Build real match, hardcode dashboard numbers** | The actual value. Report is what judges remember. |
| 4 | Email inbound webhook (Postmark/Mailgun) | **Build real webhook** | The magic demo moment. ~1hr of work. |
| 5 | Transact API call | **Mock if no time** | Proof-point for the vision, not core to winning |

### Time-boxing

| Hour | Task |
|---|---|
| 0–1 | Prepare 3–5 realistic demo statements (Quilter XLS, Transact CSV, Fidelity PDF). Do this before any code. |
| 1–3 | Feature 1: file upload + Claude parsing pipeline |
| 3–4 | Feature 4: onboarding UI + client import |
| 4–6 | Feature 2: matching + report + anomaly explanation |
| 6–7.5 | Feature 3: email inbound webhook |
| 7.5–8.5 | Feature 5: Transact mock or real call |
| 8.5–9 | Polish + pitch rehearsal (non-negotiable) |

### Build for real vs hardcode

**Build for real:**
- Claude API file parsing
- Anomaly explanation (one LLM call per flagged item)
- Inbound email webhook
- Basic fuzzy name matching

**Hardcode confidently:**
- Dashboard totals (£1.24M expected, £1.19M received, £48K gap)
- Inbox feed (3–4 pre-loaded "received" statement rows)
- Client list in onboarding (5–6 realistic firm names)
- Transact API (mock with real Transact field names)

**Don't build at all:**
- User auth / login screens
- Real database schema (Supabase free tier, minimal tables)
- Error handling for edge cases (your demo files are controlled)
- Any settings page

---

## 5. YC-Style Demo Guide

> YC demos are not product tours. They are stories that happen to have a product in them.

### The formula

| Part | What it is | Time |
|---|---|---|
| Pain | One sentence that makes the judge feel the problem | 15 sec |
| Insight | The thing everyone else missed | 15 sec |
| Product | Live demo — fewest clicks possible | 60–90 sec |
| Proof | One number that makes the value undeniable | 10 sec |
| Ask | One specific thing you want from this room | 10 sec |

---

### The script (word for word)

**Step 1 — Open with the pain** *(15 sec)*

> *"A UK financial adviser with 80 clients spends a full day every month manually re-keying income statements from 8 different platforms. They're reconciling £600,000 of their clients' money in a spreadsheet. Every month, some of it goes missing and they don't know."*

Why it lands: No judge will understand income reconciliation. This sentence makes them feel it without needing to know the industry.

---

**Step 2 — Deliver the insight** *(15 sec)*

> *"The insight is that these firms already receive every statement by email. They just don't have anything smart to do with them. We give them one email address. They forward their statements. We do the rest."*

Why it lands: This is the moment the idea clicks. "Forward an email" is the simplest possible action. It lands before you've shown anything.

---

**Step 3 — Show the onboarding** *(20 sec)*

Live on screen: show the 3-step onboarding. Click through firm name → upload the pre-prepared client Excel → receive the unique email address. Say: *"Setup takes 4 minutes."*

Why it lands: Judges need to believe real customers could actually use this. Short onboarding proves it's a product, not a script.

---

**Step 4 — The magic moment: email to report** *(30 sec)*

Live: open Gmail, forward the pre-prepared Quilter XLS to the demo email address. Wait. (Have it pre-staged if nervous about timing.) Open the reply. Show the report. Say: *"Quilter statement. 847 line items. Reconciled in 40 seconds. Two anomalies."*

Why it lands: The email lands. The report appears. The room reacts. Don't rush past this moment.

---

**Step 5 — Read one anomaly out loud** *(20 sec)*

Click the first anomaly. Read the AI explanation:

> *"14 client accounts show zero income this month against an expected £8,400. Most likely cause: Quilter quarterly payment cycle. Next payment expected 15 November. No action required."*

Why it lands: This proves AI is doing real work, not just reformatting a spreadsheet. Plain English explanation is what makes this feel like magic.

---

**Step 6 — Land the number** *(10 sec)*

> *"The average mid-size IFA firm reconciles £600K a month. IFA Dataflow charges them £300 a month for a 24-hour turnaround with no anomaly detection. We do it in 40 seconds."*

Why it lands: A specific competitor comparison with a time advantage. 24 hours vs 40 seconds.

---

**Step 7 — The ask** *(10 sec)*

> *"We're talking to three IFA firms next week. If anyone in this room has a contact at an IFA practice or a wealth management network, that introduction is worth more to us than any prize today."*

Why it lands: A specific, humble ask makes you memorable. You're already thinking about customers, not the competition. Tom Blomfield will notice this.

---

### Filming rules

| Rule | Why |
|---|---|
| No `localhost` — use production-looking URLs | `demo.localhost` screams prototype |
| Use real Gmail for the forwarding moment | Realness is the point of that moment |
| Use realistic data — actual firm names, real platform names | Fake data ("Test Company 1") breaks immersion |
| Slow, deliberate cursor movements | Nervous clicking signals the demo might break |
| Never say "as you can see" — just say what it does | Filler language dilutes confidence |
| Have the anomaly explanation pre-visible | The explanation is the wow moment, not the loading spinner |
| If something breaks: "let me show you this separately" → pivot to screenshot | Judges know prototypes break. Panic is the real killer. |

---

### If Tom Blomfield asks a question

| Question | Answer |
|---|---|
| *"How is this different from End Close?"* | End Close requires clean payment APIs. We parse unstructured PDFs and XLS from 22 platforms that have no API. Different data problem entirely. |
| *"Teach me something about this industry I don't know"* | Only 7 of 29 UK investment platforms expose an income API. Quilter — the largest by net flows — has no income feed at all. That's why this problem still exists. |
| *"Why you?"* | Answer honestly. If fintech/ops background, say it. If not: *"We've spoken to 6 IFA operations managers in the last two weeks. We know the problem better than the incumbents do."* |
| *"What's the business model?"* | £299/month SaaS per firm. IFA Dataflow charges £300 for a slower, manual version. We replace them at the same price point and automate the whole thing. |
| *"What's the network play?"* | Every IFA firm we sign is also an Appointed Representative inside a large network. Once we're inside 20 firms at Openwork, we walk into Openwork HQ with a ready-made case for the enterprise contract. |

---

## 6. Why This Wins the Room

| What judges look for | How this delivers it |
|---|---|
| Real problem | £426m SJP remediation, IFA Dataflow still manual after 20 years, 30,000 advisers affected |
| Insight others missed | They already get statements by email. One address is the entire onboarding. |
| Working product | Live file parse, live email webhook, live anomaly explanation |
| Clear customer | IFA operations manager. Specific person. Specific pain. Specific budget already spent on IFA Dataflow. |
| Founder energy | You know the domain, you built in 9 hours, you're asking for introductions not praise |

---

*Good luck. Build fast. Demo clean.*
*HackLondon 2026*
