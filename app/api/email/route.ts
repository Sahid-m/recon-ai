import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { rateLimit, EMAIL_LIMIT } from '../../../lib/ratelimit'
import { convertFile } from '../../../lib/converters'
import { classify } from '../../../agents/classifier'
import { parse } from '../../../agents/parser'
import { validate } from '../../../agents/validator'
import type { ValidatedRow } from '../../../lib/schema'
import { reconcile, toMarkdownReport, flagChargingWithoutService } from '../../../lib/reconcile'
import { rdbList, rdbRead, rdbWrite, appendReconciliationToFirm } from '../../../lib/readmedb'
import { generateText } from 'ai'
import { getModel } from '../../../lib/model'

export const runtime = 'nodejs'
export const maxDuration = 120

const resend = new Resend(process.env.RESEND_API_KEY)
const INBOUND_DOMAIN = process.env.INBOUND_DOMAIN ?? 'readmedb.com'
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugFromEmail(to: string | string[]): string {
  const addr = Array.isArray(to) ? to[0] : to
  return addr.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
}

function extractEmailAddress(raw: string): string {
  // "John Smith <john@example.com>" → "john@example.com"
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1] : raw.trim()
}

async function findFirmBySlug(slug: string): Promise<{
  firmName: string
  clients: Array<{ name: string; clientId: string; planNumber: string; platform: string; expectedMonthlyFee: number }>
} | null> {
  try {
    const files = await rdbList()
    const match = files.find(f =>
      f.name.replace('.md', '').replace(/-+/g, '') === slug.replace(/-+/g, '')
    )
    if (!match) return null

    const res = await fetch(`https://app.readmedb.com/api/v1/files/${encodeURIComponent(match.name)}`, {
      headers: { Authorization: `Bearer ${process.env.READMEDB_API_KEY}` },
    })
    const json = await res.json() as { content?: string }
    const content = json.content ?? ''
    if (!content) return null

    const headingMatch = content.match(/^#\s+(.+?)\s+—\s+Recon AI/m)
    const firmName = headingMatch ? headingMatch[1] : slug

    // Extract the clients JSON block — find the opening fence, then parse until
    // we hit a line that is exactly ``` (closing fence on its own line)
    let clients: Array<{ name: string; clientId: string; planNumber: string; platform: string; expectedMonthlyFee: number }> = []
    const startMarker = '```json clients\n'
    const startIdx = content.indexOf(startMarker)
    if (startIdx !== -1) {
      const afterMarker = content.slice(startIdx + startMarker.length)
      // Find the closing ``` on its own line
      const endIdx = afterMarker.search(/\n```(\n|$)/)
      if (endIdx !== -1) {
        const jsonStr = afterMarker.slice(0, endIdx).trim()
        try { clients = JSON.parse(jsonStr) } catch { clients = [] }
      }
    }

    return { firmName, clients }
  } catch {
    return null
  }
}

function guidanceHtml(toAddress: string, message: string): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:32px">
  <div style="background:#09090b;color:white;padding:16px 20px;border-radius:10px;margin-bottom:20px">
    <strong style="font-size:15px">Recon AI</strong>
    <span style="color:#71717a;font-size:12px;margin-left:8px">${toAddress}</span>
  </div>
  <p style="font-size:14px;line-height:1.6;color:#374151">${message}</p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
    Supported formats: XLS, XLSX, CSV · Platforms: Quilter, Transact, Fidelity, AJ Bell and more
  </p>
</body></html>`
}

function buildReplyHtml(
  firmName: string,
  fileName: string,
  slug: string,
  summary: { totalExpected: number; totalReceived: number; gap: number; autoCount: number; suggestedCount: number; unmatchedCount: number },
  anomalyExplanation: string,
  unmatchedRows: Array<{ clientName: string; planNumber: string; grossAmount: number }>,
): string {
  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const gapColor = summary.gap > 0 ? '#ef4444' : '#22c55e'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; color: #111; max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { background: #09090b; color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .header p { margin: 4px 0 0; color: #a1a1aa; font-size: 13px; }
  .cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .card { background: #f4f4f5; border-radius: 8px; padding: 14px 16px; }
  .card .label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .card .value { font-size: 20px; font-weight: 700; font-family: monospace; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 14px; font-weight: 600; margin: 0 0 10px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e4e4e7; font-size: 13px; }
  .row:last-child { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .green { background: #dcfce7; color: #15803d; }
  .amber { background: #fef9c3; color: #92400e; }
  .red { background: #fee2e2; color: #b91c1c; }
  .anomaly { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap; }
  .footer { font-size: 11px; color: #a1a1aa; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
</style></head>
<body>
  <div class="header">
    <h1>✅ ${fileName} reconciled</h1>
    <p>Recon AI · ${firmName} · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Expected</div><div class="value">${fmt(summary.totalExpected)}</div></div>
    <div class="card"><div class="label">Received</div><div class="value" style="color:#15803d">${fmt(summary.totalReceived)}</div></div>
    <div class="card"><div class="label">Gap</div><div class="value" style="color:${gapColor}">${fmt(Math.abs(summary.gap))}</div></div>
  </div>

  <div class="section">
    <h2>Match summary</h2>
    <div class="row"><span>✅ Auto-matched</span><span><strong>${summary.autoCount}</strong> rows &nbsp;<span class="badge green">no action</span></span></div>
    <div class="row"><span>🟡 Suggested match</span><span><strong>${summary.suggestedCount}</strong> rows &nbsp;<span class="badge amber">review</span></span></div>
    <div class="row"><span>🔴 Unmatched</span><span><strong>${summary.unmatchedCount}</strong> rows &nbsp;<span class="badge red">action required</span></span></div>
  </div>

  ${unmatchedRows.length > 0 ? `
  <div class="section">
    <h2>Unmatched rows</h2>
    ${unmatchedRows.map(r => `<div class="row"><span style="color:#71717a;font-family:monospace;font-size:12px">${r.planNumber}</span><span>${r.clientName || '(no name)'}</span><span style="font-family:monospace">${fmt(r.grossAmount)}</span></div>`).join('')}
  </div>` : ''}

  <div class="section">
    <h2>AI Anomaly Analysis</h2>
    <div class="anomaly">${anomalyExplanation}</div>
  </div>

  <p style="font-size:13px;color:#52525b">Full reconciliation report attached. All data saved to your Recon AI history.</p>

  <div class="footer">
    Sent by Recon AI · Forward another statement to <strong>${slug}@${INBOUND_DOMAIN}</strong>
  </div>
</body>
</html>`
}

// ── Email log ─────────────────────────────────────────────────────────────────

const EMAIL_LOG_FILE = '_email-log.json'

export interface EmailLogEntry {
  id: string
  receivedAt: string
  from: string
  to: string
  subject: string
  firmName: string
  slug: string
  attachmentName: string
  status: 'processing' | 'done' | 'error'
  durationMs?: number
  steps: Array<{ name: string; detail: string; doneAt: string }>
  summary?: { totalExpected: number; totalReceived: number; gap: number; autoCount: number; suggestedCount: number; unmatchedCount: number }
  anomalyExplanation?: string
  replySentTo?: string
  error?: string
}

async function logEmail(entry: EmailLogEntry): Promise<void> {
  try {
    const existing = await rdbRead(EMAIL_LOG_FILE)
    const logs: EmailLogEntry[] = existing ? JSON.parse(existing) : []
    const idx = logs.findIndex(l => l.id === entry.id)
    if (idx >= 0) logs[idx] = entry
    else logs.unshift(entry)
    // Keep last 200 entries
    await rdbWrite(EMAIL_LOG_FILE, JSON.stringify(logs.slice(0, 200), null, 2))
  } catch { /* non-fatal */ }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startMs = Date.now()

  try {
    const rawBody = await req.text()
    const headers = req.headers

    // Verify webhook signature
    if (WEBHOOK_SECRET) {
      try {
        resend.webhooks.verify({
          payload: rawBody,
          headers: {
            id: headers.get('svix-id') ?? '',
            timestamp: headers.get('svix-timestamp') ?? '',
            signature: headers.get('svix-signature') ?? '',
          },
          webhookSecret: WEBHOOK_SECRET,
        })
      } catch {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(rawBody)

    if (event.type !== 'email.received') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const { email_id, from, to, subject, attachments: attachmentMeta } = event.data
    const fromAddress = extractEmailAddress(from)
    const toAddress = Array.isArray(to) ? to[0] : to
    const slug = slugFromEmail(toAddress)

    // Rate limit by sender — 10 emails per hour
    const rl = rateLimit(`email:${fromAddress}`, EMAIL_LIMIT)
    if (!rl.allowed) {
      // Still reply politely rather than silently dropping
      await resend.emails.send({
        from: `Recon AI <noreply@${INBOUND_DOMAIN}>`,
        to: [fromAddress],
        subject: 'Too many requests',
        html: guidanceHtml(toAddress, `You've sent too many statements in the last hour. Please wait ${Math.ceil(rl.resetInMs / 60000)} minute(s) before sending another.`),
      })
      return NextResponse.json({ ok: true, note: 'Rate limited' }, { status: 429 })
    }

    const logEntry: EmailLogEntry = {
      id: email_id,
      receivedAt: new Date().toISOString(),
      from: fromAddress,
      to: toAddress,
      subject: subject ?? '',
      firmName: slug,
      slug,
      attachmentName: '',
      status: 'processing',
      steps: [],
    }
    await logEmail(logEntry)

    const addStep = async (name: string, detail: string) => {
      logEntry.steps.push({ name, detail, doneAt: new Date().toISOString() })
      await logEmail(logEntry)
    }

    await addStep('Email received', `From: ${fromAddress} → ${toAddress} | Subject: "${subject}"`)

    // No attachments — reply with guidance
    if (!attachmentMeta || attachmentMeta.length === 0) {
      await resend.emails.send({
        from: `Recon AI <noreply@${INBOUND_DOMAIN}>`,
        to: [fromAddress],
        subject: `Re: ${subject || 'Your email to Recon AI'}`,
        html: guidanceHtml(toAddress, `We received your email but no attachment was found. Please forward it again with your platform statement (XLS, XLSX, or CSV) attached.`),
      })
      logEntry.status = 'error'
      logEntry.error = 'No attachments found in email'
      await logEmail(logEntry)
      return NextResponse.json({ ok: true, note: 'No attachments — guidance sent' })
    }

    const spreadsheetMetas = attachmentMeta.filter((a: { filename: string }) => {
      const ext = a.filename?.split('.').pop()?.toLowerCase() ?? ''
      return ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv'].includes(ext)
    })

    // Attachment exists but wrong format
    if (spreadsheetMetas.length === 0) {
      await resend.emails.send({
        from: `Recon AI <noreply@${INBOUND_DOMAIN}>`,
        to: [fromAddress],
        subject: `Re: ${subject || 'Your email to Recon AI'}`,
        html: guidanceHtml(toAddress, `We received your email but the attachment doesn't appear to be a spreadsheet. Please attach an XLS, XLSX, or CSV file and try again.`),
      })
      logEntry.status = 'error'
      logEntry.error = 'No spreadsheet attachment found'
      await logEmail(logEntry)
      return NextResponse.json({ ok: true, note: 'Wrong attachment type — guidance sent' })
    }

    logEntry.attachmentName = spreadsheetMetas.map((a: { filename: string }) => a.filename).join(', ')
    await addStep('Attachments found', `${spreadsheetMetas.length} spreadsheet(s): ${logEntry.attachmentName}`)

    // Firm lookup — do before processing attachments so we can bail early on unknown firms
    const firm = await findFirmBySlug(slug)
    const firmName = firm?.firmName ?? slug
    const clients = firm?.clients ?? []
    logEntry.firmName = firmName
    await addStep('Firm lookup', firm ? `Found "${firmName}" — ${clients.length} clients` : `No firm found for slug "${slug}"`)

    // Unknown address — reply with onboarding instructions
    if (!firm) {
      await resend.emails.send({
        from: `Recon AI <noreply@${INBOUND_DOMAIN}>`,
        to: [fromAddress],
        subject: `Re: ${subject || 'Your email to Recon AI'}`,
        html: guidanceHtml(toAddress, `The address <strong>${toAddress}</strong> isn't linked to a Recon AI account yet.<br><br>
To get started, visit <a href="https://readmedb.com" style="color:#6366f1">readmedb.com</a>, complete the 5-minute onboarding, and you'll receive your unique inbound address. Then forward this statement again.`),
      })
      logEntry.status = 'error'
      logEntry.error = `No firm found for slug "${slug}"`
      await logEmail(logEntry)
      return NextResponse.json({ ok: true, note: 'Unknown firm — onboarding email sent' })
    }

    // Process each spreadsheet attachment sequentially, collecting all validated rows
    const allValidatedRows: ValidatedRow[] = []
    const processedFilenames: string[] = []
    const platforms: string[] = []

    for (const statementMeta of spreadsheetMetas) {
      // Fetch download URL with retry — webhook fires before Resend indexes attachments
      let downloadUrl: string | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) {
          const delay = attempt * 3000
          await addStep(`Retry ${attempt} (${statementMeta.filename})`, `Waiting ${delay / 1000}s for Resend to index email…`)
          await new Promise(r => setTimeout(r, delay))
        }
        const { data, error } = await resend.emails.receiving.attachments.get({ emailId: email_id, id: statementMeta.id })
        if (!error && data) {
          downloadUrl = (data as unknown as { download_url: string }).download_url
          break
        }
      }
      if (!downloadUrl) {
        await addStep(`⚠️ Skipped ${statementMeta.filename}`, 'Could not get download URL after retries')
        continue
      }

      let arrayBuf: ArrayBuffer
      try {
        const dlRes = await fetch(downloadUrl)
        if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status}`)
        arrayBuf = await dlRes.arrayBuffer()
      } catch (dlErr) {
        await addStep(`⚠️ Skipped ${statementMeta.filename}`, `Download failed: ${String(dlErr)}`)
        continue
      }

      const file = new File([arrayBuf], statementMeta.filename, { type: statementMeta.content_type })
      await addStep('Attachment downloaded', `${statementMeta.filename} — ${(arrayBuf.byteLength / 1024).toFixed(1)} KB`)

      try {
        const converted = await convertFile(file)
        await addStep('File converted', `${statementMeta.filename} — ${Object.keys(converted.sheets).length} sheet(s): ${Object.keys(converted.sheets).join(', ')}`)

        const classifierOutput = await classify(converted.sheets)
        await addStep('Classified', `${statementMeta.filename} — Platform: ${classifierOutput.platform} | Quirks: ${classifierOutput.quirks?.join(', ') || 'none'}`)
        if (classifierOutput.platform && !platforms.includes(classifierOutput.platform)) {
          platforms.push(classifierOutput.platform)
        }

        const parsedRows = await parse(converted.sheets, classifierOutput)

        let fileValidatedRows: ValidatedRow[]
        try {
          fileValidatedRows = await validate(parsedRows)
          const flagged = fileValidatedRows.filter(r => r.flagged).length
          await addStep('Validated', `${statementMeta.filename} — ${fileValidatedRows.length} rows, ${flagged} flagged`)
        } catch {
          fileValidatedRows = parsedRows.map(r => ({ ...r, confidence: 0, flagged: true }))
          await addStep('Validation skipped', `${statementMeta.filename} — using raw parsed rows`)
        }

        allValidatedRows.push(...fileValidatedRows)
        processedFilenames.push(statementMeta.filename)
        await addStep(`Processed ${statementMeta.filename}`, `${fileValidatedRows.length} rows`)
      } catch (parseErr) {
        await addStep(`⚠️ Skipped ${statementMeta.filename}`, `Parse error: ${String(parseErr)}`)
      }
    }

    if (processedFilenames.length === 0) {
      throw new Error('All attachments failed to parse — no rows to reconcile')
    }

    const combinedFilename = processedFilenames.join(' + ')

    // Reconcile once across all combined rows
    const validatedRows = allValidatedRows
    const matches = reconcile(validatedRows, clients)
    const auto = matches.filter(m => m.tier === 'auto')
    const suggested = matches.filter(m => m.tier === 'suggested')
    const unmatched = matches.filter(m => m.tier === 'unmatched')
    const totalReceived = matches.reduce((s, m) => s + m.parsed.grossAmount, 0)
    const totalExpected = matches.reduce((s, m) => s + (m.client?.expectedMonthlyFee ?? 0), 0)
    const gap = totalExpected - totalReceived
    const summary = { totalExpected, totalReceived, gap, autoCount: auto.length, suggestedCount: suggested.length, unmatchedCount: unmatched.length }
    await addStep('Reconciled', `✅ ${auto.length} auto · 🟡 ${suggested.length} suggested · 🔴 ${unmatched.length} unmatched | Gap: £${Math.abs(gap).toFixed(2)}`)

    // Charging-without-service flags
    const cwsFlagged = flagChargingWithoutService(matches, clients)
    if (cwsFlagged.length > 0) {
      await addStep('⚠️ Charging-without-service', `${cwsFlagged.length} clients flagged: ${cwsFlagged.join(', ')}`)
    }

    // AI anomaly explanation
    const anomalyCtxParts = [
      unmatched.length > 0 && `${unmatched.length} unmatched rows: ${unmatched.slice(0, 3).map(m => `${m.parsed.clientName} ${m.parsed.planNumber}`).join(', ')}`,
      suggested.length > 0 && `${suggested.length} low-confidence matches`,
      cwsFlagged.length > 0 && `${cwsFlagged.length} clients flagged for charging without service (no review in 12+ months): ${cwsFlagged.join(', ')}`,
    ].filter(Boolean)
    const anomalyCtx = anomalyCtxParts.join('. ')

    const platformsNote = platforms.length > 0 ? `Platforms: ${platforms.join(', ')}. ` : ''

    let anomalyExplanation = 'All rows matched with high confidence. No anomalies detected.'
    if (anomalyCtx) {
      const { text } = await generateText({
        model: getModel(),
        prompt: `UK financial adviser operations expert. Explain these reconciliation anomalies in plain English, bullet points, max 100 words:\n${anomalyCtx}\n${platformsNote}Statements: ${combinedFilename}, Firm: ${firmName}`,
      })
      anomalyExplanation = text
    }
    await addStep('AI analysis', anomalyExplanation.slice(0, 120) + (anomalyExplanation.length > 120 ? '…' : ''))

    // Build CWS section to append to markdown
    const cwsSection = cwsFlagged.length > 0
      ? `\n### 🚨 Charging Without Service\n${cwsFlagged.map(n => `- ${n}`).join('\n')}\n\n> FCA review recommended — these clients have ongoing fees but no review on record for 12+ months.\n`
      : ''

    // Save to ReadmeDB
    const markdownReport = toMarkdownReport(firmName, matches, anomalyExplanation + cwsSection, combinedFilename)
    await appendReconciliationToFirm(firmName, {
      statementFile: combinedFilename,
      date: new Date().toISOString().split('T')[0],
      ...summary,
      anomalyExplanation,
      markdownReport,
    })
    await addStep('Saved to ReadmeDB', `${firmName}.md updated`)

    // Send reply
    const allClear = unmatched.length === 0 && suggested.length === 0
    const fileCountLabel = processedFilenames.length === 1
      ? processedFilenames[0]
      : `${processedFilenames.length} statements`
    const subjectLine = allClear
      ? `✅ ${fileCountLabel} reconciled — all clear`
      : `⚠️ ${fileCountLabel} reconciled — ${unmatched.length} unmatched · £${Math.abs(gap).toFixed(0)} gap`

    const f = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const bodyHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:32px">

  <div style="background:#09090b;color:white;padding:16px 20px;border-radius:10px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <strong style="font-size:15px">Recon AI</strong>
      <div style="color:#71717a;font-size:11px;margin-top:2px">${firmName} · ${date}</div>
    </div>
    <div style="font-size:20px">${allClear ? '✅' : '⚠️'}</div>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
    <tr>
      <td style="padding:12px;background:#f9fafb;border-radius:8px 0 0 8px;border:1px solid #e5e7eb;border-right:none">
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Expected</div>
        <div style="font-size:18px;font-weight:700;font-family:monospace">${f(totalExpected)}</div>
      </td>
      <td style="padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-left:none;border-right:none">
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Received</div>
        <div style="font-size:18px;font-weight:700;font-family:monospace;color:#15803d">${f(totalReceived)}</div>
      </td>
      <td style="padding:12px;background:#f9fafb;border-radius:0 8px 8px 0;border:1px solid #e5e7eb;border-left:none">
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Gap</div>
        <div style="font-size:18px;font-weight:700;font-family:monospace;color:${gap > 0 ? '#dc2626' : '#15803d'}">${f(Math.abs(gap))}</div>
      </td>
    </tr>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <tr style="background:#f9fafb">
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e5e7eb">✅ Auto-matched</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb">${auto.length} rows</td>
    </tr>
    <tr>
      <td style="padding:10px 14px;font-size:13px;border-bottom:1px solid #e5e7eb">🟡 Needs review</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #e5e7eb">${suggested.length} rows</td>
    </tr>
    <tr style="background:#f9fafb">
      <td style="padding:10px 14px;font-size:13px">🔴 Unmatched</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;text-align:right">${unmatched.length} rows</td>
    </tr>
  </table>

  ${anomalyExplanation && anomalyExplanation !== 'All rows matched with high confidence. No anomalies detected.' ? `
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin-bottom:24px">
    <div style="font-size:11px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">AI Analysis</div>
    <div style="font-size:13px;color:#78350f;line-height:1.6;white-space:pre-wrap">${anomalyExplanation}</div>
  </div>` : ''}

  <p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;margin-top:0">
    Full reconciliation report attached · Recon AI · Forward another statement to <strong>${slug}@${INBOUND_DOMAIN}</strong>
  </p>

</body></html>`

    await resend.emails.send({
      from: `Recon AI <noreply@${INBOUND_DOMAIN}>`,
      to: [fromAddress],
      subject: subjectLine,
      html: bodyHtml,
      attachments: [{ filename: 'reconciliation-report.md', content: Buffer.from(markdownReport).toString('base64') }],
    })
    await addStep('Reply sent', `"${subjectLine}" → ${fromAddress}`)

    logEntry.status = 'done'
    logEntry.durationMs = Date.now() - startMs
    logEntry.summary = summary
    logEntry.anomalyExplanation = anomalyExplanation
    logEntry.replySentTo = fromAddress
    await logEmail(logEntry)

    return NextResponse.json({ ok: true, firm: firmName, rows: validatedRows.length, autoMatched: auto.length, unmatched: unmatched.length, replySentTo: fromAddress, durationMs: logEntry.durationMs })

  } catch (e) {
    console.error('Email webhook error:', e)
    // Best-effort: log the error so it shows in admin
    try {
      const raw = await rdbRead(EMAIL_LOG_FILE)
      const logs: EmailLogEntry[] = raw ? JSON.parse(raw) : []
      // Find an in-progress entry to mark as failed, or create a bare error entry
      const idx = logs.findIndex(l => l.status === 'processing')
      const errEntry: Partial<EmailLogEntry> = idx >= 0 ? logs[idx] : {
        id: `err-${Date.now()}`,
        receivedAt: new Date().toISOString(),
        from: '(unknown)',
        to: '(unknown)',
        subject: '(unknown)',
        firmName: '(unknown)',
        slug: '',
        attachmentName: '',
        steps: [],
      }
      errEntry.status = 'error'
      errEntry.error = String(e)
      errEntry.durationMs = Date.now() - startMs
      if (idx >= 0) logs[idx] = errEntry as EmailLogEntry
      else logs.unshift(errEntry as EmailLogEntry)
      await rdbWrite(EMAIL_LOG_FILE, JSON.stringify(logs.slice(0, 200), null, 2))
    } catch { /* truly non-fatal */ }

    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
