'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MatchedRow } from '../../lib/reconcile'

interface FirmData {
  firmName: string
  clients: Array<{ name: string; clientId: string; planNumber: string; platform: string; expectedMonthlyFee: number }>
  emailAddress: string
  setupAt: number
  transactConnected?: boolean
  transactAdviserId?: string
}

interface ReconcileResult {
  matches: MatchedRow[]
  summary: {
    totalExpected: number
    totalReceived: number
    gap: number
    autoCount: number
    suggestedCount: number
    unmatchedCount: number
  }
  anomalyExplanation: string
  markdown: string
}

type Status = 'loading' | 'idle' | 'reconciling' | 'done' | 'error'
type TransactPullStatus = 'idle' | 'pulling' | 'done' | 'error'

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseLatestFromHistory(markdown: string): (ReconcileResult & { statementFile: string }) | null {
  const sectionRegex = /## Reconciliation —[^\n]*/g
  const indices: number[] = []
  let m: RegExpExecArray | null
  while ((m = sectionRegex.exec(markdown)) !== null) indices.push(m.index)
  if (indices.length === 0) return null

  const start = indices[indices.length - 1]
  const section = markdown.slice(start)

  const statementMatch = section.match(/\*\*Statement:\*\*\s*(.+)/)
  const statementFile = statementMatch ? statementMatch[1].trim() : 'statement'

  function extractValue(label: string): number {
    const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*£?([\\d,]+\\.?\\d*)\\s*\\|`)
    const found = section.match(re)
    if (!found) return 0
    return parseFloat(found[1].replace(/,/g, ''))
  }

  function extractCount(label: string): number {
    const re = new RegExp(`\\|\\s*${label}\\s*\\|\\s*(\\d+)\\s*\\|`)
    const found = section.match(re)
    return found ? parseInt(found[1], 10) : 0
  }

  const totalExpected = extractValue('Expected')
  const totalReceived = extractValue('Received')
  const rawGap = extractValue('Gap')
  // Recompute sign: if received > expected the gap is negative (overpaid)
  const gap = totalReceived > totalExpected ? -rawGap : rawGap
  const autoCount = extractCount('Auto-matched')
  const suggestedCount = extractCount('Suggested')
  const unmatchedCount = extractCount('Unmatched')

  const anomalyMatch = section.match(/### Anomaly Analysis\n+([\s\S]+?)(?:\n---|\n## |$)/)
  const anomalyExplanation = anomalyMatch ? anomalyMatch[1].trim() : ''

  return {
    matches: [],
    summary: { totalExpected, totalReceived, gap, autoCount, suggestedCount, unmatchedCount },
    anomalyExplanation,
    markdown: section,
    statementFile,
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [firm, setFirm] = useState<FirmData | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [result, setResult] = useState<ReconcileResult | null>(null)
  const [error, setError] = useState('')
  const [statementFile, setStatementFile] = useState('')
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [firmHistory, setFirmHistory] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [transactPullStatus, setTransactPullStatus] = useState<TransactPullStatus>('idle')
  const [transactPulledAt, setTransactPulledAt] = useState<string | null>(null)
  const [cwsFlags, setCwsFlags] = useState<string[]>([])

  useEffect(() => {
    const firmData = localStorage.getItem('recon-firm')
    if (!firmData) { router.push('/onboarding'); return }
    setFirm(JSON.parse(firmData))

    // Load firm history from ReadmeDB
    const parsedFirm = JSON.parse(firmData)

    // Auto-sync client list to ReadmeDB on every dashboard load
    if (parsedFirm.clients?.length > 0) {
      fetch('/api/seed-firm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName: parsedFirm.firmName, clients: parsedFirm.clients, emailAddress: parsedFirm.emailAddress }),
      }).catch(() => {})
    }

    fetch(`/api/firm-history?firm=${encodeURIComponent(parsedFirm.firmName)}`)
      .then(r => r.json())
      .then(d => {
        if (d.content) {
          setFirmHistory(d.content)
          const parsed = parseLatestFromHistory(d.content)
          if (parsed) {
            setResult({ matches: parsed.matches, summary: parsed.summary, anomalyExplanation: parsed.anomalyExplanation, markdown: parsed.markdown })
            setCwsFlags(parseCwsFlags(parsed.markdown))
            setStatementFile(parsed.statementFile)
            setStatus(prev => prev === 'idle' ? 'done' : prev)
          }
        }
      })
      .catch(() => {})

    // Check if there's a saved reconciliation result
    const saved = sessionStorage.getItem('recon-reconcile')
    const file = sessionStorage.getItem('recon-file') ?? 'statement'
    if (saved) {
      const savedResult: ReconcileResult = JSON.parse(saved)
      setResult(savedResult)
      if (savedResult.markdown) {
        setCwsFlags(parseCwsFlags(savedResult.markdown))
      }
      setStatementFile(file)
      setStatus('done')
    } else {
      // Check if there are parsed rows to reconcile
      const parsedRaw = sessionStorage.getItem('recon-results')
      if (parsedRaw && firmData) {
        const parsed = JSON.parse(parsedRaw)
        const firm = JSON.parse(firmData)
        if (parsed?.rows?.length) {
          runReconcile(parsed.rows, firm, file)
        } else {
          setStatus('idle')
        }
      } else {
        setStatus('idle')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncToReadmeDB() {
    if (!firm) return
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/seed-firm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmName: firm.firmName, clients: firm.clients, emailAddress: firm.emailAddress }),
      })
      const data = await res.json()
      setSyncMsg(data.ok ? `✅ Synced ${firm.clients.length} clients to ReadmeDB` : '❌ Sync failed')
    } catch {
      setSyncMsg('❌ Sync failed — check connection')
    }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  async function pullTransact() {
    if (!firm?.transactConnected) return
    setTransactPullStatus('pulling')
    try {
      const res = await fetch('/api/transact-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmName: firm.firmName,
          adviserId: firm.transactAdviserId ?? '',
          apiKey: 'mock',
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setTransactPulledAt(new Date(data.pulledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      setTransactPullStatus('done')
    } catch {
      setTransactPullStatus('error')
      setTimeout(() => setTransactPullStatus('idle'), 3000)
    }
  }

  function parseCwsFlags(markdown: string): string[] {
    const match = markdown.match(/### 🚨 Charging Without Service\n+([\s\S]+?)(?:\n###|\n##|$)/)
    if (!match) return []
    return match[1].split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
  }

  async function runReconcile(
    parsedRows: unknown[],
    firmData: FirmData,
    file: string,
  ) {
    setStatus('reconciling')
    setError('')
    try {
      const res = await fetch('/api/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsedRows,
          clients: firmData.clients,
          firmName: firmData.firmName,
          statementFile: file,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: ReconcileResult = await res.json()
      setResult(data)
      if (data.markdown) {
        setCwsFlags(parseCwsFlags(data.markdown))
      }
      sessionStorage.setItem('recon-reconcile', JSON.stringify(data))
      setStatus('done')
    } catch (e) {
      setError(String(e))
      setStatus('error')
    }
  }

  if (!firm) return null

  const summary = result?.summary
  const uniquePlatforms = [...new Set(firm.clients.map(c => c.platform))].length || 0
  const autoMatches = result?.matches.filter(m => m.tier === 'auto') ?? []
  const suggestedMatches = result?.matches.filter(m => m.tier === 'suggested') ?? []
  const unmatchedMatches = result?.matches.filter(m => m.tier === 'unmatched') ?? []

  const totalMatches = summary ? (summary.autoCount + summary.suggestedCount + summary.unmatchedCount) || 1 : 1

  return (
    <div className="min-h-screen text-zinc-100" style={{ background: '#080A0C' }}>

      {/* Nav */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b backdrop-blur-md"
        style={{ background: 'rgba(8,10,12,0.85)', borderColor: '#1C2330' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
            <div className="w-2 h-2 rounded-sm bg-white/90" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-200">recon.ai</span>
        </div>
        <span className="text-zinc-700 font-mono">/</span>
        <span className="text-zinc-500 text-xs font-mono">{firm.firmName}</span>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/chat" className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 border rounded-lg hover:border-zinc-600"
            style={{ borderColor: '#1C2330' }}>
            Chat
          </Link>
          <Link href="/admin" className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 border rounded-lg hover:border-zinc-600"
            style={{ borderColor: '#1C2330' }}>
            Admin
          </Link>
          <Link href="/onboarding" className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5 border rounded-lg hover:border-zinc-600"
            style={{ borderColor: '#1C2330' }}>
            Settings
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between pb-2">
          <div>
            <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">{statementFile || 'Dashboard'}</h1>
            <p className="text-zinc-500 text-sm mt-1 font-mono">
              {firm.clients.length} clients · {uniquePlatforms} platform{uniquePlatforms !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {firmHistory && (
              <button onClick={() => setShowHistory(h => !h)}
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 px-3 py-1.5 border border-indigo-900/50 hover:border-indigo-700 rounded-lg transition-colors bg-indigo-950/20">
                {showHistory ? 'Hide history' : 'History'}
              </button>
            )}
            {result?.markdown && (
              <button onClick={() => setShowMarkdown(m => !m)}
                className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-3 py-1.5 border rounded-lg transition-colors"
                style={{ borderColor: '#1C2330' }}>
                {showMarkdown ? 'Hide' : 'View'} .md
              </button>
            )}
          </div>
        </div>

        {/* Transact Live */}
        {firm.transactConnected && (
          <div className="flex items-center justify-between rounded-xl px-5 py-3 border"
            style={{ background: 'rgba(5,46,22,0.3)', borderColor: 'rgba(22,101,52,0.4)' }}>
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-sm font-mono font-semibold">Transact Live</span>
              <span className="text-emerald-700 text-xs font-mono">
                {transactPullStatus === 'done' && transactPulledAt ? `Last pulled ${transactPulledAt}` : 'Auto-pulling'}
              </span>
            </div>
            <button onClick={pullTransact} disabled={transactPullStatus === 'pulling'}
              className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border border-emerald-800/50 text-emerald-400 hover:border-emerald-600 transition-colors disabled:opacity-50">
              {transactPullStatus === 'pulling' ? <><span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />Pulling…</> :
               transactPullStatus === 'done' ? '✓ Pulled' : 'Pull now'}
            </button>
          </div>
        )}

        {/* CWS banner */}
        {cwsFlags.length > 0 && (
          <div className="rounded-xl px-5 py-4 border flex items-start gap-3"
            style={{ background: 'rgba(69,10,10,0.3)', borderColor: 'rgba(185,28,28,0.4)' }}>
            <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-red-400 text-[10px] font-bold">!</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-300">
                {cwsFlags.length} client{cwsFlags.length > 1 ? 's' : ''} may be charging without service — FCA review recommended
              </p>
              <p className="text-xs text-red-500/80 mt-1 font-mono">{cwsFlags.join(' · ')} · No review 12+ months</p>
            </div>
          </div>
        )}

        {/* Status */}
        {status === 'reconciling' && (
          <div className="rounded-xl px-5 py-4 flex items-center gap-3 border" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium">Reconciling statement…</p>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">Matching rows against {firm.clients.length} clients · AI anomaly analysis</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-xl px-5 py-3 text-sm text-red-300 border" style={{ background: 'rgba(69,10,10,0.2)', borderColor: 'rgba(153,27,27,0.4)' }}>{error}</div>
        )}

        {/* Empty state */}
        {status === 'idle' && (
          <div className="rounded-2xl p-16 text-center border" style={{ borderColor: '#1C2330', background: '#0D1117' }}>
            <div className="w-14 h-14 rounded-2xl border mx-auto mb-6 flex items-center justify-center" style={{ borderColor: '#1C2330', background: '#131920' }}>
              <span className="text-2xl opacity-40">📊</span>
            </div>
            <p className="text-zinc-200 font-semibold text-base mb-2">No statement reconciled yet</p>
            <p className="text-zinc-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              {firm.clients.length > 0
                ? `You have ${firm.clients.length} clients ready. Upload a statement to reconcile.`
                : 'Import your client list first, then upload a statement.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/chat" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all hover:shadow-md hover:shadow-indigo-500/20">
                Upload statement
              </Link>
              {firm.clients.length === 0 && (
                <Link href="/onboarding" className="px-5 py-2.5 border text-zinc-400 hover:text-zinc-200 text-sm rounded-xl transition-colors" style={{ borderColor: '#1C2330' }}>
                  Import clients →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Markdown report */}
        {showMarkdown && result?.markdown && (
          <div className="rounded-xl overflow-hidden border" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
            <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#1C2330' }}>
              <span className="text-xs font-mono text-zinc-500">reconciliation-report.md</span>
              <button onClick={() => { const blob = new Blob([result.markdown], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reconciliation-report.md'; a.click() }} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono">↓ download</button>
            </div>
            <div className="px-5 py-4 text-sm text-zinc-300 overflow-y-auto max-h-[32rem]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                p: ({ children }) => <p className="mb-2 leading-relaxed text-zinc-300">{children}</p>,
                h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-4 first:mt-0 text-white">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-4 first:mt-0 text-zinc-100 border-b border-zinc-800 pb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-3 text-zinc-200">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 text-zinc-300">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 text-zinc-300">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                code: ({ children }) => <code className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs font-mono text-indigo-300">{children}</code>,
                pre: ({ children }) => <pre className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto my-2">{children}</pre>,
                table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse">{children}</table></div>,
                thead: ({ children }) => <thead className="bg-zinc-800">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-zinc-300 border border-zinc-700">{children}</th>,
                td: ({ children }) => <td className="px-3 py-1.5 text-zinc-300 border border-zinc-700">{children}</td>,
                tr: ({ children }) => <tr className="even:bg-zinc-800/30">{children}</tr>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500 pl-3 italic text-zinc-400 my-2">{children}</blockquote>,
                hr: () => <hr className="border-zinc-800 my-3" />,
              }}>{result.markdown}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Results */}
        {summary && (
          <>
            {/* Headline numbers */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Expected',  value: fmt(summary.totalExpected),        sub: `${firm.clients.length} client records`,           accent: '#6366f1', bg: 'rgba(99,102,241,0.06)'  },
                { label: 'Received',  value: fmt(summary.totalReceived),        sub: `${summary.autoCount + summary.suggestedCount + summary.unmatchedCount} rows parsed`, accent: '#10b981', bg: 'rgba(16,185,129,0.06)'  },
                { label: 'Gap',       value: fmt(Math.abs(summary.gap)),        sub: summary.gap > 0 ? 'shortfall' : summary.gap < 0 ? 'overpaid' : 'balanced', accent: summary.gap === 0 ? '#10b981' : '#f59e0b', bg: summary.gap === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)' },
              ].map(card => (
                <div key={card.label} className="rounded-xl p-5 border" style={{ background: card.bg, borderColor: '#1C2330' }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: '#4A5568' }}>{card.label}</p>
                  <p className="text-2xl font-bold font-mono mb-1" style={{ color: card.accent }}>{card.value}</p>
                  <p className="text-xs text-zinc-600 font-mono">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Match tiers */}
            <div className="rounded-xl border overflow-hidden" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
              <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: '#1C2330' }}>
                <h2 className="text-sm font-semibold text-zinc-200">Match breakdown</h2>
                <span className="text-[10px] font-mono text-zinc-600">{summary.autoCount + summary.suggestedCount + summary.unmatchedCount} total</span>
              </div>

              {/* Progress bar */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex rounded-full overflow-hidden h-2 gap-px">
                  {summary.autoCount > 0 && <div className="bg-emerald-500" style={{ width: `${(summary.autoCount / totalMatches) * 100}%` }} />}
                  {summary.suggestedCount > 0 && <div className="bg-amber-500" style={{ width: `${(summary.suggestedCount / totalMatches) * 100}%` }} />}
                  {summary.unmatchedCount > 0 && <div className="bg-red-500" style={{ width: `${(summary.unmatchedCount / totalMatches) * 100}%` }} />}
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: '#1C2330' }}>
                {[
                  { label: 'Auto-matched',      count: summary.autoCount,      desc: '85%+ confidence — no action needed',             color: '#10b981', dot: 'bg-emerald-500', rows: [] as typeof autoMatches },
                  { label: 'Suggested match',   count: summary.suggestedCount, desc: '60–85% confidence — review recommended',          color: '#f59e0b', dot: 'bg-amber-500',  rows: suggestedMatches },
                  { label: 'Unmatched / flagged', count: summary.unmatchedCount, desc: 'No match found — human review required',          color: '#ef4444', dot: 'bg-red-500',    rows: unmatchedMatches },
                ].map(row => (
                  <div key={row.label} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{row.label}</p>
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">{row.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold" style={{ color: row.color }}>{row.count}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{row.count > 0 ? `${((row.count / totalMatches) * 100).toFixed(0)}%` : ''}</p>
                      </div>
                    </div>
                    {row.rows.length > 0 && (
                      <div className="mt-3 ml-6 space-y-1.5">
                        {row.rows.map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-xs rounded-lg px-3 py-2 border"
                            style={{ background: '#131920', borderColor: '#1C2330' }}>
                            <div>
                              <span className="text-zinc-200">{m.parsed.clientName}</span>
                              <span className="text-zinc-600 ml-2 font-mono">{m.parsed.planNumber}</span>
                              {m.client && <span className="text-zinc-500 ml-2">→ {m.client.name}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-300 font-mono">{fmt(m.parsed.grossAmount)}</span>
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${row.label === 'Suggested match' ? 'bg-amber-950/40 text-amber-400 border-amber-900/50' : 'bg-red-950/40 text-red-400 border-red-900/50'}`}>
                                {(m.matchScore * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI anomaly */}
            <div className="rounded-xl border overflow-hidden" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
              <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: '#1C2330' }}>
                <h2 className="text-sm font-semibold text-zinc-200">AI Anomaly Analysis</h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">● live</span>
              </div>
              <div className="px-5 py-4 text-sm text-zinc-300 leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 text-zinc-200">{children}</h3>,
                  code: ({ children }) => <code className="bg-zinc-800 rounded px-1 py-0.5 text-xs font-mono text-indigo-300">{children}</code>,
                }}>{result?.anomalyExplanation ?? ''}</ReactMarkdown>
              </div>
            </div>
          </>
        )}

        {/* History */}
        {showHistory && firmHistory && (
          <div className="rounded-xl border overflow-hidden" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: '#1C2330' }}>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-zinc-200">Reconciliation History</h2>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded-full">ReadmeDB</span>
              </div>
              <button onClick={() => { const blob = new Blob([firmHistory], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${firm.firmName.toLowerCase().replace(/\s+/g, '-')}.md`; a.click() }} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono">↓ download</button>
            </div>
            <pre className="px-5 py-4 text-xs font-mono text-zinc-500 overflow-x-auto max-h-80 whitespace-pre-wrap leading-relaxed">{firmHistory}</pre>
          </div>
        )}

        {/* Email row */}
        <div className="flex items-center gap-4 rounded-xl px-5 py-4 border" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
          <div className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0" style={{ borderColor: '#1C2330', background: '#131920' }}>
            <span className="text-lg">📬</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200">Inbound address</p>
            <p className="font-mono text-indigo-400 text-sm mt-0.5 truncate">{firm.emailAddress}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-xs text-zinc-600 text-right max-w-[180px] font-mono">Forward any statement to trigger reconciliation</p>
            <button onClick={syncToReadmeDB} disabled={syncing}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border text-zinc-500 hover:text-indigo-400 hover:border-indigo-800 transition-colors disabled:opacity-40"
              style={{ borderColor: '#1C2330' }}>
              {syncing ? 'Syncing…' : '↑ Sync clients'}
            </button>
            {syncMsg && <p className="text-xs font-mono text-right text-zinc-400">{syncMsg}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <Link href="/chat" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all hover:shadow-md hover:shadow-indigo-500/20">
            Upload statement
          </Link>
          <Link href="/chat" className="flex items-center gap-2 px-5 py-2.5 border text-zinc-400 hover:text-zinc-200 text-sm font-medium rounded-xl transition-colors"
            style={{ borderColor: '#1C2330' }}>
            Ask the AI agent
          </Link>
          {result?.markdown && (
            <button onClick={() => { const blob = new Blob([result.markdown], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reconciliation-report.md'; a.click() }}
              className="px-5 py-2.5 border text-zinc-500 hover:text-zinc-300 text-sm rounded-xl transition-colors"
              style={{ borderColor: '#1C2330' }}>
              Export .md
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
