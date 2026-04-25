import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { getModel } from '../../../lib/model'
import { reconcile, toMarkdownReport } from '../../../lib/reconcile'
import type { ClientRecord, ParsedRow } from '../../../lib/reconcile'
import { appendReconciliationToFirm } from '../../../lib/readmedb'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { parsedRows, clients, firmName, statementFile } = await req.json() as {
    parsedRows: ParsedRow[]
    clients: ClientRecord[]
    firmName: string
    statementFile: string
  }

  if (!parsedRows?.length) {
    return NextResponse.json({ error: 'No parsed rows provided' }, { status: 400 })
  }

  const matches = reconcile(parsedRows, clients ?? [])

  const auto      = matches.filter(m => m.tier === 'auto')
  const suggested = matches.filter(m => m.tier === 'suggested')
  const unmatched = matches.filter(m => m.tier === 'unmatched')
  const totalReceived = matches.reduce((s, m) => s + m.parsed.grossAmount, 0)
  const totalExpected = matches.reduce((s, m) => s + (m.client?.expectedMonthlyFee ?? 0), 0)
  const gap = totalExpected - totalReceived

  // Variance rows — paid but wrong amount
  const varianceRows = matches.filter(m =>
    m.tier === 'auto' && m.variance !== null && Math.abs(m.variance) > 5
  )

  // Build anomaly prompt
  const anomalyContext = [
    unmatched.length > 0 && `Unmatched rows (${unmatched.length}): ${unmatched.map(m => `${m.parsed.clientName} plan ${m.parsed.planNumber} £${m.parsed.grossAmount}`).join('; ')}`,
    suggested.length > 0 && `Low-confidence matches (${suggested.length}): ${suggested.map(m => `${m.parsed.clientName} → ${m.client?.name ?? 'unknown'} (${(m.matchScore * 100).toFixed(0)}%)`).join('; ')}`,
    varianceRows.length > 0 && `Amount variances: ${varianceRows.map(m => `${m.client?.name} expected £${m.client?.expectedMonthlyFee} received £${m.parsed.grossAmount} (${m.variance! > 0 ? '+' : ''}${m.variance!.toFixed(2)})`).join('; ')}`,
    clients.length > 0 && parsedRows.length < clients.length && `Only ${parsedRows.length} rows received vs ${clients.length} expected clients — ${clients.length - parsedRows.length} clients show no income this month.`,
  ].filter(Boolean).join('\n')

  let anomalyExplanation = '_No anomalies detected. All rows matched with high confidence._'

  if (anomalyContext) {
    const { text } = await generateText({
      model: getModel(),
      prompt: `You are a UK financial adviser operations assistant. Write a plain-English anomaly explanation for an IFA firm reconciliation report.

Be specific, practical, and concise. Give the most likely cause and say whether action is needed.
Use bullet points, one per anomaly type. Max 120 words total.

Anomalies found:
${anomalyContext}

Statement: ${statementFile}
Platform: ${parsedRows[0]?.platformName ?? 'Unknown'}`,
    })
    anomalyExplanation = text
  }

  const markdown = toMarkdownReport(firmName ?? 'Unknown Firm', matches, anomalyExplanation, statementFile ?? 'unknown')

  // Persist to ReadmeDB — one file per firm, append each reconciliation
  try {
    await appendReconciliationToFirm(firmName ?? 'unknown-firm', {
      statementFile: statementFile ?? 'unknown',
      date: new Date().toISOString().split('T')[0],
      totalExpected,
      totalReceived,
      gap,
      autoCount: auto.length,
      suggestedCount: suggested.length,
      unmatchedCount: unmatched.length,
      anomalyExplanation,
      markdownReport: markdown,
    })
  } catch (e) {
    // Non-fatal — log but don't fail the response
    console.error('ReadmeDB save failed:', e)
  }

  return NextResponse.json({
    matches,
    summary: {
      totalExpected,
      totalReceived,
      gap,
      autoCount: auto.length,
      suggestedCount: suggested.length,
      unmatchedCount: unmatched.length,
    },
    anomalyExplanation,
    markdown,
  })
}
