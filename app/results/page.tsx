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
    <div className="min-h-screen text-zinc-100" style={{ background: '#080A0C' }}>
      {/* Nav */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b backdrop-blur-md"
        style={{ background: 'rgba(8,10,12,0.85)', borderColor: '#1C2330' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-white/90" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-200">recon.ai</span>
        </div>
        <span className="text-zinc-700 font-mono">/</span>
        <span className="text-zinc-500 text-xs font-mono">results</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/dashboard" className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 border rounded-lg" style={{ borderColor: '#1C2330' }}>
            Dashboard
          </Link>
          <Link href="/chat" className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 border rounded-lg" style={{ borderColor: '#1C2330' }}>
            Upload another
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {error && (
          <div className="rounded-xl px-5 py-3 text-sm text-amber-300 border font-mono" style={{ background: 'rgba(78,52,10,0.2)', borderColor: 'rgba(180,120,0,0.3)' }}>{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total rows',   value: rows.length,  accent: '#94a3b8', bg: 'rgba(148,163,184,0.05)' },
            { label: 'Auto-matched', value: autoMatched,  accent: '#10b981', bg: 'rgba(16,185,129,0.05)', sub: '≥ 80%' },
            { label: 'Needs review', value: needsReview,  accent: '#f59e0b', bg: 'rgba(245,158,11,0.05)', sub: '70–80%' },
            { label: 'Flagged',      value: flagged,      accent: '#ef4444', bg: 'rgba(239,68,68,0.05)',  sub: '< 70%' },
          ].map(c => (
            <div key={c.label} className="rounded-xl p-4 border" style={{ background: c.bg, borderColor: '#1C2330' }}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#4A5568' }}>{c.label}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: c.accent }}>{c.value}</p>
              {'sub' in c && <p className="text-[10px] text-zinc-600 mt-1 font-mono">{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-xl px-5 py-4 flex items-center justify-between border" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: '#4A5568' }}>Total reconciled</p>
            <p className="text-3xl font-bold font-mono text-emerald-400">{fmt(total)}</p>
          </div>
          <Link href="/dashboard" className="text-xs font-mono px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all hover:shadow-md hover:shadow-indigo-500/20">
            Full reconciliation →
          </Link>
        </div>

        {/* Row table */}
        <div className="rounded-xl border overflow-hidden" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: '#1C2330' }}>
            <h2 className="text-sm font-semibold text-zinc-200">Parsed rows</h2>
            <div className="flex items-center gap-1">
              {(['all', 'ok', 'flagged'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="text-[11px] font-mono px-2.5 py-1 rounded-lg transition-colors"
                  style={{
                    background: filter === f ? '#1C2330' : 'transparent',
                    color: filter === f ? '#E2E8F0' : '#6B7787',
                  }}>
                  {f === 'all' ? `All (${rows.length})` : f === 'ok' ? `Clean (${autoMatched})` : `Flagged (${flagged + needsReview})`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-widest font-mono" style={{ borderColor: '#1C2330', color: '#4A5568' }}>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Platform</th>
                  <th className="px-4 py-3 text-left">Fee type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i}
                    className="border-b transition-colors"
                    style={{
                      borderColor: '#1C2330',
                      background: row.flagged ? 'rgba(127,29,29,0.08)' : i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}>
                    <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.clientName}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500">{row.planNumber}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.platformName}</td>
                    <td className="px-4 py-2.5 text-zinc-600 font-mono">{row.feeType}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-200">{fmt(row.grossAmount)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-600">{row.paymentDate}</td>
                    <td className="px-4 py-2.5 text-center">
                      <ConfidenceBadge score={row.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-zinc-700 text-xs font-mono">No rows match this filter</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
