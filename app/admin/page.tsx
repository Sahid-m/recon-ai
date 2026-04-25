'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EmailLogEntry } from '../api/email/route'

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmt(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatusBadge({ status }: { status: EmailLogEntry['status'] }) {
  const styles = {
    done: 'bg-green-950/60 text-green-400 border-green-900',
    processing: 'bg-amber-950/60 text-amber-400 border-amber-900 animate-pulse',
    error: 'bg-red-950/60 text-red-400 border-red-900',
  }
  const labels = { done: '✅ done', processing: '⏳ processing', error: '❌ error' }
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function AdminPage() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([])
  const [selected, setSelected] = useState<EmailLogEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [tick, setTick] = useState(0)

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/emails')
      const { logs } = await res.json()
      setLogs(logs ?? [])
      setLastRefresh(Date.now())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchLogs()
    const iv = setInterval(fetchLogs, 10000)
    const tickIv = setInterval(() => setTick(t => t + 1), 1000)
    return () => { clearInterval(iv); clearInterval(tickIv) }
  }, [])

  // Auto-select first on load
  useEffect(() => {
    if (!selected && logs.length > 0) setSelected(logs[0])
  }, [logs, selected])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-mono text-sm text-zinc-300 font-semibold">readmedb.com</span>
        </div>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm font-mono">admin</span>
        <div className="ml-auto flex items-center gap-3">
          {/* Live status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-800 rounded-lg">
            <div className={`w-1.5 h-1.5 rounded-full ${logs.some(l => l.status === 'processing') ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[10px] font-mono text-zinc-500">
              {logs.some(l => l.status === 'processing') ? 'processing' : `server ok · ${Math.floor((tick * 0 + Date.now() - lastRefresh) / 1000)}s ago`}
            </span>
          </div>
          <button
            onClick={fetchLogs}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg"
          >
            ↻ Refresh
          </button>
          <Link href="/dashboard" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 border border-zinc-800 rounded-lg">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — inbox list */}
        <div className="w-80 border-r border-zinc-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Inbound emails</span>
            <span className="text-xs font-mono text-zinc-600">{logs.length} total</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center h-40 text-zinc-600 text-sm font-mono">
                Loading…
              </div>
            )}
            {!loading && logs.length === 0 && (
              <div className="p-5">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
                  <p className="text-xs font-mono text-zinc-400 font-semibold mb-2">⏳ Waiting for emails</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">No emails processed yet. Check:</p>
                  <ol className="mt-2 space-y-1.5 text-[11px] font-mono text-zinc-600 list-decimal list-inside">
                    <li>ngrok running → <span className="text-zinc-400">ngrok http 3000</span></li>
                    <li>Resend webhook URL set to ngrok URL <span className="text-zinc-400">/api/email</span></li>
                    <li>Event type: <span className="text-zinc-400">email.received</span></li>
                    <li>Send email to <span className="text-zinc-400">yourfirm@readmedb.com</span> with XLS attached</li>
                  </ol>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs font-mono text-zinc-500 mb-2">Test webhook manually:</p>
                  <code className="text-[10px] text-indigo-400 break-all leading-relaxed">
                    POST https://xxxx.ngrok.io/api/email
                  </code>
                </div>
              </div>
            )}
            {logs.map(log => (
              <button
                key={log.id}
                onClick={() => setSelected(log)}
                className={`w-full text-left px-4 py-3.5 border-b border-zinc-800/60 hover:bg-zinc-900 transition-colors ${selected?.id === log.id ? 'bg-zinc-900 border-l-2 border-l-indigo-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-300 truncate">{log.from}</span>
                  <StatusBadge status={log.status} />
                </div>
                <div className="text-[11px] text-zinc-500 truncate mb-1">{log.subject || '(no subject)'}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400">{log.firmName}</span>
                  <span className="text-[10px] font-mono text-zinc-600">{timeAgo(log.receivedAt)}</span>
                </div>
                {log.attachmentName && (
                  <div className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate">📎 {log.attachmentName}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-sm">
              Select an email to inspect
            </div>
          ) : (
            <div className="p-6 max-w-3xl">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <StatusBadge status={selected.status} />
                  {selected.durationMs && (
                    <span className="text-[10px] font-mono text-zinc-600">
                      {(selected.durationMs / 1000).toFixed(1)}s total
                    </span>
                  )}
                </div>
                <h1 className="text-lg font-semibold text-zinc-100 mb-1">{selected.subject || '(no subject)'}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-zinc-500">
                  <span>From: <span className="text-zinc-300">{selected.from}</span></span>
                  <span>To: <span className="text-zinc-300">{selected.to}</span></span>
                  <span>Firm: <span className="text-indigo-400">{selected.firmName}</span></span>
                  <span>{timeAgo(selected.receivedAt)}</span>
                </div>
              </div>

              {/* Summary cards — only when done */}
              {selected.status === 'done' && selected.summary && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: 'Expected', value: fmt(selected.summary.totalExpected), color: 'text-zinc-200' },
                    { label: 'Received', value: fmt(selected.summary.totalReceived), color: 'text-green-400' },
                    { label: 'Gap', value: fmt(Math.abs(selected.summary.gap)), color: selected.summary.gap > 0 ? 'text-red-400' : 'text-green-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mb-1">{c.label}</div>
                      <div className={`text-xl font-mono font-bold ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {selected.status === 'done' && selected.summary && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { label: '✅ Auto-matched', value: selected.summary.autoCount, color: 'text-green-400' },
                    { label: '🟡 Suggested', value: selected.summary.suggestedCount, color: 'text-amber-400' },
                    { label: '🔴 Unmatched', value: selected.summary.unmatchedCount, color: 'text-red-400' },
                  ].map(c => (
                    <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                      <div className="text-[10px] font-mono text-zinc-600 mb-1">{c.label}</div>
                      <div className={`text-2xl font-mono font-bold ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Processing timeline */}
              <div className="mb-6">
                <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Processing steps</h2>
                <div className="space-y-0">
                  {selected.steps.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        {i < selected.steps.length - 1 && (
                          <div className="w-px flex-1 bg-zinc-800 my-0.5" />
                        )}
                      </div>
                      <div className="pb-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-zinc-200">{step.name}</span>
                          <span className="text-[10px] font-mono text-zinc-600">
                            {new Date(step.doneAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono leading-relaxed">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                  {selected.status === 'processing' && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-1.5 shrink-0" />
                      </div>
                      <div className="pb-4">
                        <span className="text-sm text-amber-400 font-mono">Running…</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI analysis */}
              {selected.anomalyExplanation && (
                <div className="mb-6">
                  <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">AI Anomaly Analysis</h2>
                  <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {selected.anomalyExplanation}
                  </div>
                </div>
              )}

              {/* Error */}
              {selected.error && (
                <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 text-sm text-red-400 font-mono">
                  {selected.error}
                </div>
              )}

              {/* Reply info */}
              {selected.replySentTo && (
                <div className="mt-4 text-xs font-mono text-zinc-600">
                  Reply sent to <span className="text-zinc-400">{selected.replySentTo}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
