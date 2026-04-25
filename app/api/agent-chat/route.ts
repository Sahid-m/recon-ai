import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs } from 'ai'
import { rateLimit, CHAT_LIMIT } from '../../../lib/ratelimit'
import { z } from 'zod'
import { zodSchema } from 'ai'
import { getModel } from '../../../lib/model'
import { reconcile } from '../../../lib/reconcile'
import { getFirmFile, appendReconciliationToFirm, rdbRead, rdbWrite, rdbAppend, rdbDelete, rdbList, firmFileName } from '../../../lib/readmedb'
import { generateText as genText } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export type ChatEvent =
  | { type: 'tool_start'; tool: string; description: string }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'tool_error'; tool: string; error: string }
  | { type: 'text_delta'; text: string }
  | { type: 'done'; text: string }
  | { type: 'error'; error: string }

function encode(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

type ToolResult = Record<string, unknown>

type FirmData = {
  firmName: string
  clients: Array<{ name: string; clientId: string; planNumber: string; platform: string; expectedMonthlyFee: number }>
  emailAddress: string
}

type ParsedRow = {
  clientName: string
  planNumber: string
  feeType: string
  grossAmount: number
  paymentDate: string
  platformName: string
  confidence?: number
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = rateLimit(`chat:${ip}`, CHAT_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(rl.resetInMs / 1000)}s.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
    )
  }

  const body = await req.json()
  const { message, firm, parsedRows, history } = body as {
    message: string
    firm: FirmData | null
    parsedRows: ParsedRow[] | null
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  // Pre-load firm history and email log so the agent has full context immediately
  let firmHistory = ''
  let emailLogSummary = ''
  if (firm) {
    try {
      firmHistory = (await getFirmFile(firm.firmName)) ?? ''
    } catch { /* non-fatal */ }
    try {
      const raw = await rdbRead('_email-log.json')
      if (raw) {
        const logs = JSON.parse(raw) as Array<{
          receivedAt: string; from: string; subject: string; firmName: string;
          status: string; summary?: { totalExpected: number; totalReceived: number; gap: number; autoCount: number; suggestedCount: number; unmatchedCount: number };
          attachmentName?: string; anomalyExplanation?: string;
        }>
        const firmLogs = logs.filter(l =>
          l.firmName?.toLowerCase().replace(/\s+/g, '-') === firm.firmName.toLowerCase().replace(/\s+/g, '-')
        ).slice(0, 20)
        if (firmLogs.length > 0) {
          emailLogSummary = firmLogs.map(l => {
            const s = l.summary
            return `- ${l.receivedAt.slice(0, 10)} | ${l.status} | ${l.attachmentName ?? 'unknown'} | Expected £${s?.totalExpected?.toFixed(2) ?? '?'} | Received £${s?.totalReceived?.toFixed(2) ?? '?'} | Gap £${s?.gap?.toFixed(2) ?? '?'} | Auto ${s?.autoCount ?? '?'} Suggested ${s?.suggestedCount ?? '?'} Unmatched ${s?.unmatchedCount ?? '?'}${l.anomalyExplanation ? `\n  AI: ${l.anomalyExplanation.slice(0, 200)}` : ''}`
          }).join('\n')
        }
      }
    } catch { /* non-fatal */ }
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const enc = new TextEncoder()
  const send = (event: ChatEvent) => writer.write(enc.encode(encode(event)))

  ;(async () => {
    try {
      const { text } = await generateText({
        model: getModel(),
        system: `You are Recon AI — an intelligent income reconciliation assistant for UK IFA firms.
You have full access to ReadmeDB (persistent markdown file store) and the full email processing history for this firm.

## Response formatting (always follow)
- Respond in **Markdown format** always
- Use **bold** for key numbers, firm names, important terms
- Use tables for reconciliation results, client lists, match breakdowns
- Use bullet lists for anomalies, action items, multi-point explanations
- Use \`code\` for plan numbers, file names, identifiers
- Lead with the most important finding, then detail
- For reconciliation summaries always include: total expected, total received, gap, match counts in a table

## Tools available
- Use tools to answer every data question. Never invent numbers.
- Use \`get_email_log\` to look up specific email reconciliation runs
- Use \`get_firm_history\` to read the full firm markdown history
- Use \`read_readmedb_file\` / \`write_readmedb_file\` for any other files

## Session context
- Firm: **${firm?.firmName ?? 'Not set up'}**
- Clients loaded: ${firm?.clients.length ?? 0}
- Email address: ${firm?.emailAddress ?? 'N/A'}
- Parsed rows in session: ${parsedRows?.length ?? 0}
- Firm history file: ${firm ? firmFileName(firm.firmName) : 'none'}

${emailLogSummary ? `## Email reconciliation history (most recent 20 runs)\n${emailLogSummary}` : '## Email reconciliation history\nNo email runs found for this firm yet.'}

${firmHistory ? `## Firm ReadmeDB file (full content)\n\`\`\`\n${firmHistory.slice(0, 6000)}${firmHistory.length > 6000 ? '\n... (truncated, use get_firm_history tool for full content)' : ''}\n\`\`\`` : ''}`,
        messages: [
          ...history.map(h => ({ role: h.role, content: h.content } as { role: 'user' | 'assistant'; content: string })),
          { role: 'user' as const, content: message },
        ],
        tools: {
          reconcile_statement: {
            description: 'Reconcile parsed statement rows against client records. Returns match tiers and gap.',
            inputSchema: zodSchema(z.object({
              focus: z.string().describe('What aspect to focus the analysis on'),
            })),
            execute: async ({ focus }: { focus: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'reconcile_statement', description: 'Matching rows against client records…' })
              if (!parsedRows?.length) return { error: 'No parsed rows. Upload a statement first.' }
              if (!firm?.clients?.length) return { error: 'No clients imported. Complete onboarding first.' }
              const matches = reconcile(parsedRows, firm.clients)
              const auto = matches.filter(m => m.tier === 'auto')
              const suggested = matches.filter(m => m.tier === 'suggested')
              const unmatched = matches.filter(m => m.tier === 'unmatched')
              const totalReceived = matches.reduce((s, m) => s + m.parsed.grossAmount, 0)
              const totalExpected = matches.reduce((s, m) => s + (m.client?.expectedMonthlyFee ?? 0), 0)
              const result: ToolResult = {
                totalExpected: `£${totalExpected.toFixed(2)}`,
                totalReceived: `£${totalReceived.toFixed(2)}`,
                gap: `£${(totalExpected - totalReceived).toFixed(2)}`,
                autoMatched: auto.length,
                suggested: suggested.length,
                unmatched: unmatched.length,
                unmatchedRows: unmatched.map(m => ({ client: m.parsed.clientName, plan: m.parsed.planNumber, amount: `£${m.parsed.grossAmount.toFixed(2)}` })),
                focus,
              }
              await send({ type: 'tool_result', tool: 'reconcile_statement', result })
              return result
            },
          },

          get_email_log: {
            description: 'Get detailed email reconciliation log entries for this firm. Use to answer questions about past reconciliations, gaps, anomalies, specific dates.',
            inputSchema: zodSchema(z.object({
              limit: z.number().optional().describe('Max entries to return, default 10'),
              status: z.enum(['done', 'error', 'processing', 'all']).optional().describe('Filter by status'),
            })),
            execute: async ({ limit = 10, status = 'all' }: { limit?: number; status?: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'get_email_log', description: 'Loading email reconciliation log…' })
              try {
                const raw = await rdbRead('_email-log.json')
                if (!raw) return { found: false, message: 'No email log yet.' }
                const allLogs = JSON.parse(raw) as Array<Record<string, unknown>>
                const firmLogs = allLogs.filter(l => {
                  const lFirm = String(l.firmName ?? '').toLowerCase().replace(/\s+/g, '-')
                  const curFirm = (firm?.firmName ?? '').toLowerCase().replace(/\s+/g, '-')
                  return lFirm === curFirm || lFirm.includes(curFirm) || curFirm.includes(lFirm)
                })
                const filtered = status === 'all' ? firmLogs : firmLogs.filter(l => l.status === status)
                const result: ToolResult = {
                  total: filtered.length,
                  entries: filtered.slice(0, limit).map(l => ({
                    date: String(l.receivedAt ?? '').slice(0, 10),
                    subject: l.subject,
                    from: l.from,
                    status: l.status,
                    attachment: l.attachmentName,
                    summary: l.summary,
                    anomalyExplanation: l.anomalyExplanation,
                    steps: (l.steps as Array<{ name: string; detail: string }> | undefined)?.map(s => `${s.name}: ${s.detail}`),
                    durationMs: l.durationMs,
                    error: l.error,
                  })),
                }
                await send({ type: 'tool_result', tool: 'get_email_log', result })
                return result
              } catch (e) {
                return { error: String(e) }
              }
            },
          },

          get_firm_history: {
            description: 'Read the full reconciliation history markdown file for this firm from ReadmeDB.',
            inputSchema: zodSchema(z.object({})),
            execute: async (): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'get_firm_history', description: `Loading ${firm?.firmName ?? 'firm'} history from ReadmeDB…` })
              if (!firm) return { error: 'No firm set up.' }
              const content = await getFirmFile(firm.firmName)
              const result: ToolResult = content
                ? { found: true, content, totalLength: content.length }
                : { found: false, message: 'No history yet. Reconcile a statement to create it.' }
              await send({ type: 'tool_result', tool: 'get_firm_history', result })
              return result
            },
          },

          get_client_list: {
            description: 'List imported clients with plan numbers and expected fees.',
            inputSchema: zodSchema(z.object({
              filter_platform: z.string().optional().describe('Filter by platform name'),
            })),
            execute: async ({ filter_platform }: { filter_platform?: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'get_client_list', description: 'Fetching client records…' })
              if (!firm?.clients?.length) return { error: 'No clients imported.' }
              const filtered = filter_platform
                ? firm.clients.filter(c => c.platform.toLowerCase().includes(filter_platform.toLowerCase()))
                : firm.clients
              const total = filtered.reduce((s, c) => s + c.expectedMonthlyFee, 0)
              const result: ToolResult = {
                count: filtered.length,
                totalMonthlyExpected: `£${total.toFixed(2)}`,
                platforms: [...new Set(filtered.map(c => c.platform))],
                clients: filtered.slice(0, 10).map(c => ({ name: c.name, plan: c.planNumber, platform: c.platform, fee: `£${c.expectedMonthlyFee}` })),
                more: Math.max(0, filtered.length - 10),
              }
              await send({ type: 'tool_result', tool: 'get_client_list', result })
              return result
            },
          },

          get_parsed_rows: {
            description: 'Show statement rows parsed in the current session.',
            inputSchema: zodSchema(z.object({
              limit: z.number().optional().describe('Max rows to show, default 10'),
            })),
            execute: async ({ limit = 10 }: { limit?: number }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'get_parsed_rows', description: 'Reading parsed statement rows from session…' })
              if (!parsedRows?.length) return { error: 'No parsed rows. Upload a statement first.' }
              const result: ToolResult = {
                total: parsedRows.length,
                totalAmount: `£${parsedRows.reduce((s, r) => s + r.grossAmount, 0).toFixed(2)}`,
                platform: parsedRows[0]?.platformName,
                rows: parsedRows.slice(0, limit).map(r => ({
                  client: r.clientName, plan: r.planNumber,
                  amount: `£${r.grossAmount.toFixed(2)}`, date: r.paymentDate,
                  confidence: r.confidence !== undefined ? `${(r.confidence * 100).toFixed(0)}%` : 'N/A',
                })),
              }
              await send({ type: 'tool_result', tool: 'get_parsed_rows', result })
              return result
            },
          },

          explain_anomaly: {
            description: 'Generate a plain-English AI explanation for an anomaly or reconciliation question.',
            inputSchema: zodSchema(z.object({
              question: z.string().describe('The anomaly or question to explain'),
              context: z.string().optional().describe('Relevant data context'),
            })),
            execute: async ({ question, context }: { question: string; context?: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'explain_anomaly', description: 'Generating AI anomaly explanation…' })
              const { text } = await genText({
                model: getModel(),
                prompt: `UK financial adviser operations expert. Answer concisely in plain English (max 80 words):
Question: ${question}${context ? `\nContext: ${context}` : ''}
Firm: ${firm?.firmName ?? 'Unknown'}`,
              })
              const result: ToolResult = { explanation: text }
              await send({ type: 'tool_result', tool: 'explain_anomaly', result })
              return result
            },
          },

          save_to_readmedb: {
            description: "Append a note to the firm's main history file on ReadmeDB.",
            inputSchema: zodSchema(z.object({
              note: z.string().describe('The note or content to save'),
            })),
            execute: async ({ note }: { note: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'save_to_readmedb', description: `Appending to ${firm?.firmName ?? 'firm'}.md on ReadmeDB…` })
              if (!firm) return { error: 'No firm set up.' }
              await appendReconciliationToFirm(firm.firmName, {
                statementFile: 'manual-note',
                date: new Date().toISOString().split('T')[0],
                totalExpected: 0, totalReceived: 0, gap: 0,
                autoCount: 0, suggestedCount: 0, unmatchedCount: 0,
                anomalyExplanation: note,
                markdownReport: note,
              })
              const result: ToolResult = { saved: true, file: firm ? firmFileName(firm.firmName) : 'unknown' }
              await send({ type: 'tool_result', tool: 'save_to_readmedb', result })
              return result
            },
          },

          list_readmedb_files: {
            description: 'List all files stored in ReadmeDB for this namespace. Call this to orient yourself at session start.',
            inputSchema: zodSchema(z.object({})),
            execute: async (): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'list_readmedb_files', description: 'Listing all files in ReadmeDB namespace…' })
              const files = await rdbList()
              const result: ToolResult = {
                count: files.length,
                files: files.map(f => ({ name: f.name, size: `${(f.size / 1024).toFixed(1)} KB`, updatedAt: f.updatedAt })),
              }
              await send({ type: 'tool_result', tool: 'list_readmedb_files', result })
              return result
            },
          },

          read_readmedb_file: {
            description: 'Read any file from ReadmeDB by name.',
            inputSchema: zodSchema(z.object({
              filename: z.string().describe('Exact filename to read, e.g. "notes.md" or "flagged-clients.md"'),
            })),
            execute: async ({ filename }: { filename: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'read_readmedb_file', description: `Reading ${filename} from ReadmeDB…` })
              const content = await rdbRead(filename)
              const result: ToolResult = content
                ? { found: true, filename, content, length: content.length }
                : { found: false, filename, message: 'File not found.' }
              await send({ type: 'tool_result', tool: 'read_readmedb_file', result })
              return result
            },
          },

          write_readmedb_file: {
            description: 'Create or overwrite any file in ReadmeDB. Use for temp notes, analysis, flagged items, summaries — anything.',
            inputSchema: zodSchema(z.object({
              filename: z.string().describe('Filename to write, e.g. "notes.md", "temp-analysis.md", "flagged-clients.md"'),
              content: z.string().describe('Full markdown content to write'),
              append: z.boolean().optional().describe('If true, append to existing file instead of overwriting'),
            })),
            execute: async ({ filename, content, append = false }: { filename: string; content: string; append?: boolean }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'write_readmedb_file', description: `${append ? 'Appending to' : 'Writing'} ${filename} on ReadmeDB…` })
              if (append) {
                await rdbAppend(filename, content)
              } else {
                await rdbWrite(filename, content)
              }
              const result: ToolResult = { written: true, filename, mode: append ? 'append' : 'overwrite', bytes: content.length }
              await send({ type: 'tool_result', tool: 'write_readmedb_file', result })
              return result
            },
          },

          delete_readmedb_file: {
            description: 'Delete a file from ReadmeDB permanently.',
            inputSchema: zodSchema(z.object({
              filename: z.string().describe('Filename to delete'),
            })),
            execute: async ({ filename }: { filename: string }): Promise<ToolResult> => {
              await send({ type: 'tool_start', tool: 'delete_readmedb_file', description: `Deleting ${filename} from ReadmeDB…` })
              await rdbDelete(filename)
              const result: ToolResult = { deleted: true, filename }
              await send({ type: 'tool_result', tool: 'delete_readmedb_file', result })
              return result
            },
          },
        },
        stopWhen: stepCountIs(8),
      })

      await send({ type: 'done', text })
    } catch (e) {
      await send({ type: 'error', error: String(e) })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
