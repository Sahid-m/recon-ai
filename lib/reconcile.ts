export interface ClientRecord {
  name: string
  clientId: string
  planNumber: string
  platform: string
  expectedMonthlyFee: number
  lastReviewDate?: string
}

export interface ParsedRow {
  clientName: string
  planNumber: string
  feeType: string
  grossAmount: number
  paymentDate: string
  platformName: string
  confidence?: number
  flagged?: boolean
}

export type MatchTier = 'auto' | 'suggested' | 'unmatched'

export interface MatchedRow {
  parsed: ParsedRow
  client: ClientRecord | null
  tier: MatchTier
  matchScore: number
  variance: number | null  // parsed amount - expected, null if unmatched
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function planScore(a: string, b: string): number {
  const na = normalise(a)
  const nb = normalise(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.85
  // suffix match (last 6 chars)
  if (na.slice(-6) === nb.slice(-6) && na.length >= 4) return 0.7
  return 0
}

function nameScore(a: string, b: string): number {
  const wa = normalise(a).split(/\s+/)
  const wb = normalise(b).split(/\s+/)
  const shared = wa.filter(w => wb.some(x => x.includes(w) || w.includes(x)))
  return shared.length / Math.max(wa.length, wb.length)
}

export function flagChargingWithoutService(matches: MatchedRow[], clients: ClientRecord[]): string[] {
  const twelvMonthsAgo = new Date()
  twelvMonthsAgo.setFullYear(twelvMonthsAgo.getFullYear() - 1)

  const clientsWithFees = new Set(
    matches
      .filter(m => m.tier !== 'unmatched' && m.client !== null)
      .map(m => m.client!.name)
  )

  return clients
    .filter(client => {
      if (!clientsWithFees.has(client.name)) return false
      if (!client.lastReviewDate) return true
      const reviewDate = new Date(client.lastReviewDate)
      return reviewDate < twelvMonthsAgo
    })
    .map(client => client.name)
}

export function reconcile(parsedRows: ParsedRow[], clients: ClientRecord[]): MatchedRow[] {
  return parsedRows.map(row => {
    let bestClient: ClientRecord | null = null
    let bestScore = 0

    for (const client of clients) {
      const ps = planScore(row.planNumber, client.planNumber)
      const ns = nameScore(row.clientName, client.name)
      // plan number is the strongest signal
      const score = ps * 0.7 + ns * 0.3
      if (score > bestScore) {
        bestScore = score
        bestClient = client
      }
    }

    const tier: MatchTier =
      bestScore >= 0.85 ? 'auto' :
      bestScore >= 0.6  ? 'suggested' :
      'unmatched'

    const variance = bestClient
      ? row.grossAmount - bestClient.expectedMonthlyFee
      : null

    return { parsed: row, client: bestClient, tier, matchScore: bestScore, variance }
  })
}

export function toMarkdownReport(
  firmName: string,
  matches: MatchedRow[],
  anomalyExplanation: string,
  statementFile: string,
): string {
  const auto      = matches.filter(m => m.tier === 'auto')
  const suggested = matches.filter(m => m.tier === 'suggested')
  const unmatched = matches.filter(m => m.tier === 'unmatched')
  const totalReceived = matches.reduce((s, m) => s + m.parsed.grossAmount, 0)
  const totalExpected = matches.reduce((s, m) => s + (m.client?.expectedMonthlyFee ?? 0), 0)
  const gap = totalExpected - totalReceived
  const date = new Date().toISOString().split('T')[0]

  const fmtRow = (m: MatchedRow) =>
    `| ${m.parsed.clientName} | ${m.parsed.planNumber} | £${m.parsed.grossAmount.toFixed(2)} | ${m.parsed.paymentDate} | ${(m.matchScore * 100).toFixed(0)}% |`

  return `---
title: Reconciliation Report — ${firmName}
date: ${date}
file: ${statementFile}
total_expected: ${totalExpected.toFixed(2)}
total_received: ${totalReceived.toFixed(2)}
gap: ${gap.toFixed(2)}
auto_matched: ${auto.length}
suggested: ${suggested.length}
unmatched: ${unmatched.length}
---

# Reconciliation Report
**Firm:** ${firmName}
**Statement:** ${statementFile}
**Date:** ${date}

## Summary
| | Count | Amount |
|---|---|---|
| ✅ Auto-matched | ${auto.length} | £${auto.reduce((s, m) => s + m.parsed.grossAmount, 0).toFixed(2)} |
| 🟡 Suggested | ${suggested.length} | £${suggested.reduce((s, m) => s + m.parsed.grossAmount, 0).toFixed(2)} |
| 🔴 Unmatched | ${unmatched.length} | £${unmatched.reduce((s, m) => s + m.parsed.grossAmount, 0).toFixed(2)} |
| **Total received** | ${matches.length} | **£${totalReceived.toFixed(2)}** |
| **Total expected** | — | **£${totalExpected.toFixed(2)}** |
| **Gap** | — | **£${gap.toFixed(2)}** |

## AI Anomaly Analysis
${anomalyExplanation}

## Auto-matched Rows
| Client | Plan | Amount | Date | Score |
|---|---|---|---|---|
${auto.map(fmtRow).join('\n')}

## Suggested Matches (review needed)
| Client | Plan | Amount | Date | Score |
|---|---|---|---|---|
${suggested.length > 0 ? suggested.map(fmtRow).join('\n') : '_(none)_'}

## Unmatched Rows
| Client | Plan | Amount | Date | Score |
|---|---|---|---|---|
${unmatched.length > 0 ? unmatched.map(fmtRow).join('\n') : '_(none)_'}
`
}
