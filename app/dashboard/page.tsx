'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  const gap = extractValue('Gap')
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-mono text-sm text-zinc-300 font-semibold">readmedb.com</span>
        </div>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm font-mono">{firm.firmName}</span>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/chat" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg">
            Upload statement
          </Link>
          <Link href="/admin" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg">
            📬 Admin
          </Link>
          <Link href="/onboarding" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            Settings
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{statementFile || 'Dashboard'}</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {firm.clients.length} clients · {uniquePlatforms} platforms
            </p>
          </div>
          <div className="flex items-center gap-2">
            {firmHistory && (
              <button onClick={() => setShowHistory(h => !h)} className="text-xs font-mono text-indigo-400 hover:text-indigo-300 px-3 py-1.5 border border-indigo-900/60 rounded-lg transition-colors">
                {showHistory ? 'Hide' : '📋 History'}
              </button>
            )}
            {result?.markdown && (
              <button onClick={() => setShowMarkdown(m => !m)} className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-3 py-1.5 border border-zinc-800 rounded-lg transition-colors">
                {showMarkdown ? 'Hide' : 'View'} report .md
              </button>
            )}
          </div>
        </div>

        {/* Transact Live badge */}
        {firm.transactConnected && (
          <div className="flex items-center justify-between bg-green-950/30 border border-green-800/40 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-sm font-mono font-semibold">● Transact Live</span>
              <span className="text-green-600 text-xs">
                {transactPullStatus === 'done' && transactPulledAt
                  ? `Last pulled: ${transactPulledAt}`
                  : 'Last pulled: just now'}
              </span>
            </div>
            <button
              onClick={pullTransact}
              disabled={transactPullStatus === 'pulling'}
              className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border border-green-800/60 text-green-400 hover:border-green-600 hover:text-green-300 transition-colors disabled:opacity-50"
            >
              {transactPullStatus === 'pulling' ? (
                <>
                  <span className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  Pulling…
                </>
              ) : transactPullStatus === 'done' ? '✓ Pulled' : 'Pull now'}
            </button>
          </div>
        )}

        {/* Charging-without-service banner */}
        {cwsFlags.length > 0 && (
          <div className="bg-red-950/30 border border-red-700/50 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-lg shrink-0">🚨</span>
              <div>
                <p className="text-sm font-semibold text-red-300">
                  {cwsFlags.length} client{cwsFlags.length > 1 ? 's' : ''} may be charging without service — FCA review recommended
                </p>
                <p className="text-xs text-red-500 mt-1">
                  {cwsFlags.join(', ')} · No review on record for 12+ months
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status banners */}
        {status === 'reconciling' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium">Reconciling statement…</p>
              <p className="text-xs text-zinc-500 mt-0.5">Matching rows against {firm.clients.length} clients and analysing anomalies with AI</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-5 py-4 text-sm text-red-300">{error}</div>
        )}

        {/* Empty state */}
        {status === 'idle' && (
          <div className="border border-zinc-800 rounded-2xl p-12 text-center space-y-4">
            <div className="text-5xl opacity-20">📊</div>
            <div>
              <p className="text-zinc-200 font-semibold">No statement reconciled yet</p>
              <p className="text-zinc-500 text-sm mt-1">
                Upload a statement to see real reconciliation results.<br />
                {firm.clients.length > 0
                  ? `You have ${firm.clients.length} clients ready to match against.`
                  : 'Go to Settings to import your client list first.'}
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Link href="/chat" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
                📎 Upload statement
              </Link>
              {firm.clients.length === 0 && (
                <Link href="/onboarding" className="px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:border-zinc-600 text-sm rounded-lg transition-colors">
                  Import clients →
                </Link>
              )}
            </div>
            <p className="text-xs text-zinc-600 pt-2">
              Demo files: <code className="text-zinc-500">public/quilter-october-2024.csv</code> · <code className="text-zinc-500">hartley-partners-clients.xlsx</code>
            </p>
          </div>
        )}

        {/* Markdown report viewer */}
        {showMarkdown && result?.markdown && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400">reconciliation-report.md</span>
              <button onClick={() => { const blob = new Blob([result.markdown], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reconciliation-report.md'; a.click() }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">↓ download</button>
            </div>
            <pre className="px-4 py-3 text-xs font-mono text-zinc-400 overflow-x-auto max-h-64 whitespace-pre-wrap">{result.markdown}</pre>
          </div>
        )}

        {/* Real results */}
        {summary && (
          <>
            {/* Headline numbers */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Expected', value: fmt(summary.totalExpected), sub: `from ${firm.clients.length} client records`, color: 'text-zinc-100' },
                { label: 'Received', value: fmt(summary.totalReceived), sub: `${result!.matches.length} rows parsed`, color: 'text-green-400' },
                { label: 'Gap', value: fmt(Math.abs(summary.gap)), sub: summary.gap > 0 ? 'shortfall' : summary.gap < 0 ? 'overpaid' : 'balanced', color: summary.gap === 0 ? 'text-green-400' : 'text-amber-400' },
              ].map(card => (
                <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">{card.label}</p>
                  <p className={`text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-zinc-600 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Match tiers */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold">Match summary</h2>
              </div>
              <div className="divide-y divide-zinc-800">
                {[
                  { icon: '✅', label: 'Auto-matched', count: summary.autoCount, amount: autoMatches.reduce((s, m) => s + m.parsed.grossAmount, 0), desc: '85%+ confidence — no action needed', color: 'text-green-400', rows: [] as typeof autoMatches },
                  { icon: '🟡', label: 'Suggested match', count: summary.suggestedCount, amount: suggestedMatches.reduce((s, m) => s + m.parsed.grossAmount, 0), desc: '60–85% confidence — review recommended', color: 'text-amber-400', rows: suggestedMatches },
                  { icon: '🔴', label: 'Unmatched / flagged', count: summary.unmatchedCount, amount: unmatchedMatches.reduce((s, m) => s + m.parsed.grossAmount, 0), desc: 'No client match found — human review required', color: 'text-red-400', rows: unmatchedMatches },
                ].map(row => (
                  <div key={row.label} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <span className="text-lg shrink-0">{row.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="text-xs text-zinc-500">{row.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-mono font-semibold ${row.color}`}>{fmt(row.amount)}</p>
                        <p className="text-xs text-zinc-600">{row.count} items</p>
                      </div>
                    </div>
                    {row.rows.length > 0 && (
                      <div className="mt-3 ml-9 space-y-1.5">
                        {row.rows.map((m, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-zinc-800/50 rounded-lg px-3 py-2">
                            <div>
                              <span className="text-zinc-200">{m.parsed.clientName}</span>
                              <span className="text-zinc-600 ml-2 font-mono">{m.parsed.planNumber}</span>
                              {m.client && <span className="text-zinc-500 ml-2">→ {m.client.name}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-300 font-mono">{fmt(m.parsed.grossAmount)}</span>
                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${row.label === 'Suggested match' ? 'bg-amber-950/60 text-amber-400' : 'bg-red-950/60 text-red-400'}`}>{(m.matchScore * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI anomaly analysis */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold">AI Anomaly Analysis</h2>
                <span className="text-xs font-mono text-green-400 bg-green-950/40 border border-green-900/40 px-2 py-0.5 rounded">live</span>
              </div>
              <div className="px-5 py-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {result?.anomalyExplanation}
              </div>
            </div>
          </>
        )}

        {/* Firm history from ReadmeDB */}
        {showHistory && firmHistory && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Reconciliation History</h2>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">ReadmeDB</span>
              </div>
              <button onClick={() => { const blob = new Blob([firmHistory], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${firm.firmName.toLowerCase().replace(/\s+/g, '-')}.md`; a.click() }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">↓ download</button>
            </div>
            <pre className="px-5 py-4 text-xs font-mono text-zinc-400 overflow-x-auto max-h-80 whitespace-pre-wrap leading-relaxed">{firmHistory}</pre>
          </div>
        )}

        {/* Email + actions */}
        <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4">
          <span className="text-2xl">📬</span>
          <div className="flex-1">
            <p className="text-sm font-medium">Your inbound address</p>
            <p className="font-mono text-indigo-300 text-sm mt-0.5">{firm.emailAddress}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs text-zinc-500 text-right max-w-[200px]">Forward any statement here to trigger automatic reconciliation</p>
            <button
              onClick={syncToReadmeDB}
              disabled={syncing}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-indigo-600 hover:text-indigo-400 transition-colors disabled:opacity-40"
            >
              {syncing ? '⏳ Syncing…' : '↑ Sync clients to ReadmeDB'}
            </button>
            {syncMsg && <p className="text-xs font-mono text-right">{syncMsg}</p>}
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/chat" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
            📎 Upload new statement
          </Link>
          {result?.markdown && (
            <button onClick={() => { const blob = new Blob([result.markdown], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'reconciliation-report.md'; a.click() }} className="px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:border-zinc-600 text-sm rounded-lg transition-colors">
              Export .md report
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
