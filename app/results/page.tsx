'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ValidatedRow } from '../../lib/schema'

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-green-400 bg-green-950/40 border-green-900/60'
    : pct >= 70 ? 'text-amber-400 bg-amber-950/40 border-amber-900/60'
    : 'text-red-400 bg-red-950/40 border-red-900/60'
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>{pct}%</span>
  )
}

export default function ResultsPage() {
  const [rows, setRows] = useState<ValidatedRow[]>([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'flagged' | 'ok'>('all')
  const router = useRouter()

  useEffect(() => {
    const raw = sessionStorage.getItem('recon-results')
    if (!raw) { router.push('/'); return }
    const data = JSON.parse(raw)
    if (!data.success && data.error) setError(data.error)
    setRows(data.rows ?? [])
  }, [router])

  const total = rows.reduce((sum, r) => sum + r.grossAmount, 0)
  const autoMatched = rows.filter(r => r.confidence >= 0.8).length
  const needsReview = rows.filter(r => r.confidence >= 0.7 && r.confidence < 0.8).length
  const flagged = rows.filter(r => r.confidence < 0.7).length

  const filtered = rows.filter(r => {
    if (filter === 'flagged') return r.flagged || r.confidence < 0.8
    if (filter === 'ok') return !r.flagged && r.confidence >= 0.8
    return true
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-mono text-sm text-zinc-300 font-semibold">recon.ai</span>
        </div>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm font-mono">results</span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg">
            Dashboard
          </Link>
          <Link href="/chat" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg">
            Upload another
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {error && (
          <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl px-5 py-4 text-sm text-amber-300">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total rows', value: rows.length, color: 'text-zinc-100' },
            { label: 'Auto-matched', value: autoMatched, color: 'text-green-400', sub: '≥ 80% confidence' },
            { label: 'Needs review', value: needsReview, color: 'text-amber-400', sub: '70–80%' },
            { label: 'Flagged', value: flagged, color: 'text-red-400', sub: '< 70%' },
          ].map(c => (
            <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">{c.label}</p>
              <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</p>
              {c.sub && <p className="text-[10px] text-zinc-600 mt-1">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Total reconciled</p>
            <p className="text-3xl font-bold font-mono text-green-400">{fmt(total)}</p>
          </div>
          <Link href="/dashboard" className="text-xs font-mono px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
            View full reconciliation →
          </Link>
        </div>

        {/* Row table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">All rows</h2>
            <div className="flex items-center gap-1">
              {(['all', 'ok', 'flagged'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors ${
                    filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f === 'all' ? `All (${rows.length})` : f === 'ok' ? `Clean (${autoMatched})` : `Flagged (${flagged + needsReview})`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-mono uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-left">Plan</th>
                  <th className="px-4 py-2.5 text-left">Platform</th>
                  <th className="px-4 py-2.5 text-left">Fee type</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((row, i) => (
                  <tr key={i} className={`hover:bg-zinc-800/30 transition-colors ${row.flagged ? 'bg-red-950/10' : ''}`}>
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.clientName}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-400">{row.planNumber}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.platformName}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{row.feeType}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-200">{fmt(row.grossAmount)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500">{row.paymentDate}</td>
                    <td className="px-4 py-2.5 text-center">
                      <ConfidenceBadge score={row.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-zinc-600 text-sm font-mono">No rows match this filter</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
