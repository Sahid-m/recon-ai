'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'  // used for template download only

interface ClientRecord {
  name: string
  clientId: string
  planNumber: string
  platform: string
  expectedMonthlyFee: number
  lastReviewDate?: string
}

const CRM_OPTIONS = [
  { id: 'intelliflo', name: 'Intelliflo', logo: '🔷', desc: 'OAuth connection', oauth: true },
  { id: 'ajbell',     name: 'AJ Bell',    logo: '🔔', desc: 'OAuth connection', oauth: true },
  { id: 'xplan',      name: 'Xplan',      logo: '🟦', desc: 'API key',          oauth: false },
  { id: 'salesforce', name: 'Salesforce', logo: '☁️',  desc: 'OAuth connection', oauth: false },
  { id: 'dynamics',   name: 'Dynamics 365', logo: '🪟', desc: 'OAuth connection', oauth: false },
]

const DEMO_CLIENTS: ClientRecord[] = [
  { name: 'James Hargreaves',    clientId: 'CLI001', planNumber: 'QU-448821', platform: 'Quilter',    expectedMonthlyFee: 412.50 },
  { name: 'Margaret Thornton',   clientId: 'CLI002', planNumber: 'QU-229034', platform: 'Quilter',    expectedMonthlyFee: 285.00 },
  { name: 'David Patel',         clientId: 'CLI003', planNumber: 'TR-998821', platform: 'Transact',   expectedMonthlyFee: 620.00 },
  { name: 'Sarah Wentworth',     clientId: 'CLI004', planNumber: 'TR-447102', platform: 'Transact',   expectedMonthlyFee: 195.75 },
  { name: 'Robert Ashworth',     clientId: 'CLI005', planNumber: 'FI-334455', platform: 'Fidelity',   expectedMonthlyFee: 530.00 },
  { name: 'Patricia Newcombe',   clientId: 'CLI006', planNumber: 'FI-221987', platform: 'Fidelity',   expectedMonthlyFee: 340.00 },
  { name: 'Thomas Ellison',      clientId: 'CLI007', planNumber: 'AJ-778831', platform: 'AJ Bell',    expectedMonthlyFee: 875.00 },
  { name: 'Jennifer Blackwood',  clientId: 'CLI008', planNumber: 'AJ-556620', platform: 'AJ Bell',    expectedMonthlyFee: 150.00 },
  { name: 'Charles Pemberton',   clientId: 'CLI009', planNumber: 'AE-103456', platform: 'Aegon',      expectedMonthlyFee: 460.00 },
  { name: 'Amanda Forsythe',     clientId: 'CLI010', planNumber: 'AE-209871', platform: 'Aegon',      expectedMonthlyFee: 310.00 },
  { name: 'William Garside',     clientId: 'CLI011', planNumber: 'QU-551234', platform: 'Quilter',    expectedMonthlyFee: 720.00 },
  { name: 'Helen Cartwright',    clientId: 'CLI012', planNumber: 'QU-330912', platform: 'Quilter',    expectedMonthlyFee: 255.00 },
  { name: 'Michael Drummond',    clientId: 'CLI013', planNumber: 'TR-661543', platform: 'Transact',   expectedMonthlyFee: 490.00 },
  { name: 'Susan Whitfield',     clientId: 'CLI014', planNumber: 'FI-445122', platform: 'Fidelity',   expectedMonthlyFee: 380.00 },
  { name: 'Geoffrey Stanton',    clientId: 'CLI015', planNumber: 'AJ-334490', platform: 'AJ Bell',    expectedMonthlyFee: 215.00 },
  { name: 'Catherine Lowe',      clientId: 'CLI016', planNumber: 'QU-772341', platform: 'Quilter',    expectedMonthlyFee: 640.00 },
  { name: 'Richard Fernsby',     clientId: 'CLI017', planNumber: 'TR-889012', platform: 'Transact',   expectedMonthlyFee: 175.00 },
  { name: 'Elizabeth Moorfield', clientId: 'CLI018', planNumber: 'AE-334871', platform: 'Aegon',      expectedMonthlyFee: 920.00 },
  { name: 'Jonathan Barker',     clientId: 'CLI019', planNumber: 'FI-556001', platform: 'Fidelity',   expectedMonthlyFee: 445.00 },
  { name: 'Diana Whitmore',      clientId: 'CLI020', planNumber: 'QU-119234', platform: 'Quilter',    expectedMonthlyFee: 305.00 },
  // Aviva clients
  { name: 'Caroline Pemberton',  clientId: 'CLI021', planNumber: 'AV-112233', platform: 'Aviva',      expectedMonthlyFee: 385.00 },
  { name: 'Oliver Stanhope',     clientId: 'CLI022', planNumber: 'AV-445566', platform: 'Aviva',      expectedMonthlyFee: 520.00 },
  { name: 'Rachel Whitmore',     clientId: 'CLI023', planNumber: 'AV-778899', platform: 'Aviva',      expectedMonthlyFee: 240.00 },
  // Hubwise clients
  { name: 'Benjamin Ashford',    clientId: 'CLI024', planNumber: 'HW-334411', platform: 'Hubwise',    expectedMonthlyFee: 680.00 },
  { name: 'Harriet Forsythe',    clientId: 'CLI025', planNumber: 'HW-556677', platform: 'Hubwise',    expectedMonthlyFee: 420.00 },
  // Nucleus clients
  { name: 'Frederick Langley',   clientId: 'CLI026', planNumber: 'NUC-22341', platform: 'Nucleus',    expectedMonthlyFee: 570.00 },
  { name: 'Victoria Drummond',   clientId: 'CLI027', planNumber: 'NUC-88901', platform: 'Nucleus',    expectedMonthlyFee: 315.00 },
  // Parmenion clients
  { name: 'Sebastian Hartley',   clientId: 'CLI028', planNumber: 'PAR-44123', platform: 'Parmenion',  expectedMonthlyFee: 460.00 },
  { name: 'Isabella Thornton',   clientId: 'CLI029', planNumber: 'PAR-66789', platform: 'Parmenion',  expectedMonthlyFee: 290.00 },
]

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [firmName, setFirmName] = useState('')
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [importError, setImportError] = useState('')
  const [importMethod, setImportMethod] = useState<'crm' | 'excel' | null>(null)
  const [connectingCrm, setConnectingCrm] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // OAuth state per CRM
  const [oauthConnected, setOauthConnected] = useState<Record<string, boolean>>({})
  const [oauthLoading, setOauthLoading] = useState<Record<string, boolean>>({})
  const [oauthError, setOauthError] = useState<Record<string, string>>({})

  const fetchOauthClients = useCallback(async (crmId: string) => {
    setOauthLoading(prev => ({ ...prev, [crmId]: true }))
    setOauthError(prev => ({ ...prev, [crmId]: '' }))
    try {
      const endpoint = crmId === 'intelliflo' ? '/api/intelliflo/clients'
        : crmId === 'ajbell' ? '/api/ajbell/accounts'
        : null
      if (!endpoint) return

      const res = await fetch(endpoint)
      if (res.status === 401) {
        setOauthError(prev => ({ ...prev, [crmId]: 'Session expired — please reconnect' }))
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { clients: ClientRecord[]; count: number }
      if (data.clients.length > 0) {
        setClients(data.clients)
        setOauthConnected(prev => ({ ...prev, [crmId]: true }))
      } else {
        setOauthError(prev => ({ ...prev, [crmId]: 'Connected but no clients found' }))
      }
    } catch (e) {
      setOauthError(prev => ({ ...prev, [crmId]: `Failed to load clients: ${e}` }))
    }
    setOauthLoading(prev => ({ ...prev, [crmId]: false }))
  }, [])

  useEffect(() => {
    const connected = searchParams.get('intelliflo') === 'connected' ? 'intelliflo'
      : searchParams.get('ajbell') === 'connected' ? 'ajbell'
      : null
    const error = searchParams.get('error')

    if (connected) {
      setImportMethod('crm')
      fetchOauthClients(connected)
    }
    if (error) {
      setImportMethod('crm')
      const crmId = error.startsWith('ajbell') ? 'ajbell' : 'intelliflo'
      setOauthError(prev => ({ ...prev, [crmId]: `OAuth error: ${error}` }))
    }
  }, [searchParams, fetchOauthClients])

  // Transact API connection state
  const [showTransact, setShowTransact] = useState(false)
  const [transactAdviserId, setTransactAdviserId] = useState('')
  const [transactApiKey, setTransactApiKey] = useState('')
  const [transactConnecting, setTransactConnecting] = useState(false)
  const [transactConnected, setTransactConnected] = useState(false)

  const connectTransact = async () => {
    if (!transactAdviserId.trim() || !transactApiKey.trim()) return
    setTransactConnecting(true)
    await new Promise(r => setTimeout(r, 1200))
    setTransactConnected(true)
    setTransactConnecting(false)
  }

  const emailAddress = `${slugify(firmName) || 'yourfirm'}@readmedb.com`

  // Seed ReadmeDB the moment clients are loaded so the email address is live instantly
  const seededRef = useRef<string>('')
  useEffect(() => {
    if (clients.length === 0 || !firmName.trim()) return
    const key = `${firmName}:${clients.length}`
    if (seededRef.current === key) return
    seededRef.current = key
    localStorage.setItem('recon-firm', JSON.stringify({ firmName, clients, emailAddress, setupAt: Date.now() }))
    fetch('/api/seed-firm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firmName, clients, emailAddress }),
    }).catch(() => {})
  }, [clients, firmName, emailAddress])

  const [fileLoading, setFileLoading] = useState(false)

  const handleFile = async (file: File) => {
    setImportError('')
    setFileLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-clients', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setImportError(err.error ?? 'Failed to parse file')
        return
      }
      const data = await res.json() as { clients: ClientRecord[]; count: number }
      if (data.clients.length === 0) {
        setImportError('No clients found in this file — try the template format or a different file.')
        return
      }
      setClients(data.clients)
    } catch {
      setImportError('Could not read file. Try again or use the template.')
    } finally {
      setFileLoading(false)
    }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Client Name', 'Client ID', 'Plan Number', 'Platform', 'Expected Monthly Fee'],
      ['John Smith', 'CLI001', 'QU123456', 'Quilter', 250],
      ['Jane Doe', 'CLI002', 'TR789012', 'Transact', 180],
      ['Bob Wilson', 'CLI003', 'FI334455', 'Fidelity', 320],
    ])
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')
    XLSX.writeFile(wb, 'readmedb-clients.xlsx')
  }

  const finish = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080A0C', color: '#E2E8F0' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: '#1C2330' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
            <div className="w-2.5 h-2.5 rounded-sm bg-white/90" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-200">recon.ai</span>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === step ? 'w-6 bg-indigo-500' : n < step ? 'w-4 bg-indigo-700' : 'w-4 bg-zinc-800'}`} />
          ))}
          <span className="text-xs font-mono text-zinc-600 ml-1">{step}/3</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Step 1 of 3</p>
                <h1 className="text-3xl font-bold text-zinc-50 leading-tight">
                  What&apos;s your firm called?
                </h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  We&apos;ll set up your account and generate your unique email address.
                </p>
              </div>

              <input
                autoFocus
                type="text"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && firmName.trim() && setStep(2)}
                placeholder="Smith Wealth Management"
                className="w-full text-xl border-0 border-b-2 outline-none pb-3 bg-transparent placeholder-zinc-700 transition-colors"
                style={{ borderColor: firmName.trim() ? '#6366f1' : '#1C2330', color: '#E2E8F0' }}
              />

              {firmName.trim() && (
                <p className="text-xs text-zinc-500 font-mono">
                  Your address →{' '}
                  <span className="text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">{emailAddress}</span>
                </p>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={!firmName.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-md hover:shadow-indigo-500/20"
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Step 2 of 3</p>
                <h1 className="text-3xl font-bold text-zinc-50 leading-tight">Import your clients</h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  We match income against this to catch missing or wrong payments.
                </p>
              </div>

              {clients.length === 0 ? (
                <div className="space-y-2.5">
                  {/* CRM */}
                  <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#1C2330' }}>
                    <button onClick={() => setImportMethod(importMethod === 'crm' ? null : 'crm')}
                      className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
                      style={{ background: importMethod === 'crm' ? '#0D1117' : 'transparent' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm" style={{ borderColor: '#1C2330', background: '#131920' }}>🔗</div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">Connect your CRM</p>
                          <p className="text-xs text-zinc-600">Intelliflo, Xplan, Salesforce, Dynamics</p>
                        </div>
                      </div>
                      <span className="text-zinc-700 text-xs font-mono">{importMethod === 'crm' ? '▴' : '▾'}</span>
                    </button>
                    {importMethod === 'crm' && (
                      <div className="border-t divide-y" style={{ borderColor: '#1C2330' }}>
                        {CRM_OPTIONS.map(crm => {
                          const isOAuth = crm.oauth && (
                            crm.id === 'intelliflo' ? !!process.env.NEXT_PUBLIC_INTELLIFLO_ENABLED
                            : crm.id === 'ajbell' ? !!process.env.NEXT_PUBLIC_AJBELL_ENABLED
                            : false
                          )
                          const loading = oauthLoading[crm.id] || connectingCrm === crm.id
                          const connected = oauthConnected[crm.id]
                          const error = oauthError[crm.id]

                          return (
                            <div key={crm.id} className="border-b last:border-0" style={{ borderColor: '#1C2330' }}>
                              <button
                                onClick={() => {
                                  if (crm.id === 'intelliflo') {
                                    window.location.href = '/api/auth/intelliflo'
                                    return
                                  }
                                  if (crm.id === 'ajbell') {
                                    window.location.href = '/api/auth/ajbell'
                                    return
                                  }
                                  // Other CRMs — demo simulation
                                  setConnectingCrm(crm.id)
                                  setTimeout(() => { setConnectingCrm(null); setClients(DEMO_CLIENTS) }, 2200)
                                }}
                                disabled={loading}
                                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-900/40 transition-colors disabled:opacity-60 text-left"
                              >
                                <span className="text-lg w-7 text-center">{crm.logo}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-zinc-200">{crm.name}</p>
                                    {isOAuth && (
                                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded-full">
                                        Real OAuth
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-600">
                                    {crm.id === 'intelliflo' ? 'OpenID Connect — live client data'
                                      : crm.id === 'ajbell' ? 'OAuth 2.0 — live account data'
                                      : crm.desc}
                                  </p>
                                </div>
                                {loading ? (
                                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono">
                                    <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                    {oauthLoading[crm.id] ? 'Loading clients…' : 'Connecting…'}
                                  </div>
                                ) : connected ? (
                                  <span className="text-xs text-emerald-400 font-mono">✓ Connected</span>
                                ) : (
                                  <span className="text-xs text-zinc-600 border rounded-lg px-3 py-1 hover:border-zinc-500 hover:text-zinc-400 transition-colors font-mono" style={{ borderColor: '#1C2330' }}>
                                    {crm.oauth ? 'Authorise →' : 'Connect'}
                                  </span>
                                )}
                              </button>

                              {error && (
                                <div className="px-5 pb-3 text-xs text-red-400 font-mono">{error}</div>
                              )}
                              {connected && clients.length > 0 && (
                                <div className="px-5 pb-3 text-xs text-emerald-500 font-mono">
                                  {clients.length} clients imported from {crm.name}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Excel */}
                  <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#1C2330' }}>
                    <button onClick={() => setImportMethod(importMethod === 'excel' ? null : 'excel')}
                      className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
                      style={{ background: importMethod === 'excel' ? '#0D1117' : 'transparent' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm" style={{ borderColor: '#1C2330', background: '#131920' }}>📂</div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">Upload Excel / CSV</p>
                          <p className="text-xs text-zinc-600">Or download our template to get started</p>
                        </div>
                      </div>
                      <span className="text-zinc-700 text-xs font-mono">{importMethod === 'excel' ? '▴' : '▾'}</span>
                    </button>
                    {importMethod === 'excel' && (
                      <div className="border-t p-4 space-y-3" style={{ borderColor: '#1C2330' }}>
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                          onClick={() => !fileLoading && fileRef.current?.click()}
                          className="border-2 border-dashed rounded-xl p-8 text-center transition-all"
                          style={{ borderColor: fileLoading ? '#6366f1' : dragOver ? '#6366f1' : '#1C2330', background: dragOver ? 'rgba(99,102,241,0.05)' : '#0D1117', cursor: fileLoading ? 'wait' : 'pointer' }}>
                          {fileLoading ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              <p className="text-sm text-indigo-400 font-mono">Analysing file with AI…</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-zinc-500">Drop file here or click to browse</p>
                              <p className="text-xs text-zinc-700 mt-1 font-mono">.xlsx · .xls · .csv — any format</p>
                            </>
                          )}
                          <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
                        </div>
                        {importError && <p className="text-xs text-red-400 font-mono">{importError}</p>}
                        <button onClick={downloadTemplate} className="w-full text-xs text-zinc-600 hover:text-zinc-300 py-2 transition-colors font-mono">
                          Download template ↓
                        </button>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setClients(DEMO_CLIENTS)}
                    className="w-full text-xs text-zinc-600 hover:text-zinc-400 py-2 transition-colors font-mono">
                    Use demo client data →
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl px-5 py-4 flex items-center gap-4 border" style={{ background: 'rgba(5,46,22,0.2)', borderColor: 'rgba(22,101,52,0.3)' }}>
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-900/50 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm shrink-0">
                    {clients.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">{clients.length} clients imported</p>
                    <p className="text-xs text-zinc-500 truncate font-mono mt-0.5">
                      {clients.slice(0, 3).map(c => c.name.split(' ')[0]).join(', ')}{clients.length > 3 ? ` +${clients.length - 3} more` : ''}
                    </p>
                  </div>
                  <button onClick={() => { setClients([]); setImportMethod(null) }}
                    className="text-xs text-zinc-600 hover:text-zinc-300 shrink-0 transition-colors font-mono">
                    Change
                  </button>
                </div>
              )}

              {/* Transact */}
              <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#1C2330' }}>
                <button onClick={() => setShowTransact(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border flex items-center justify-center text-sm" style={{ borderColor: '#1C2330', background: '#131920' }}>⚡</div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        Connect Transact API
                        <span className="ml-2 text-[10px] font-mono text-zinc-600 border rounded px-1.5 py-0.5" style={{ borderColor: '#1C2330' }}>optional</span>
                      </p>
                      <p className="text-xs text-zinc-600">Pull income automatically</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {transactConnected && <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">● Connected</span>}
                    <span className="text-zinc-700 text-xs font-mono">{showTransact ? '▴' : '▾'}</span>
                  </div>
                </button>
                {showTransact && (
                  <div className="border-t p-4 space-y-3" style={{ borderColor: '#1C2330', background: '#0D1117' }}>
                    {transactConnected ? (
                      <div className="flex items-center gap-3 rounded-xl px-4 py-3 border" style={{ background: 'rgba(5,46,22,0.2)', borderColor: 'rgba(22,101,52,0.3)' }}>
                        <span className="text-emerald-400">✓</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-emerald-300">Transact connected</p>
                          <p className="text-xs text-emerald-600 font-mono">Adviser ID: {transactAdviserId}</p>
                        </div>
                        <button onClick={() => { setTransactConnected(false); setTransactAdviserId(''); setTransactApiKey('') }}
                          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono">
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <>
                        <input type="text" value={transactAdviserId} onChange={e => setTransactAdviserId(e.target.value)}
                          placeholder="Adviser ID (e.g. ADV-12345)"
                          className="w-full text-sm rounded-xl px-4 py-2.5 border outline-none transition-colors font-mono placeholder-zinc-700"
                          style={{ background: '#131920', borderColor: '#1C2330', color: '#E2E8F0' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                          onBlur={e => e.currentTarget.style.borderColor = '#1C2330'} />
                        <input type="password" value={transactApiKey} onChange={e => setTransactApiKey(e.target.value)}
                          placeholder="API Key"
                          className="w-full text-sm rounded-xl px-4 py-2.5 border outline-none transition-colors font-mono placeholder-zinc-700"
                          style={{ background: '#131920', borderColor: '#1C2330', color: '#E2E8F0' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#6366f1'}
                          onBlur={e => e.currentTarget.style.borderColor = '#1C2330'} />
                        <button onClick={connectTransact} disabled={!transactAdviserId.trim() || !transactApiKey.trim() || transactConnecting}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-30 transition-colors">
                          {transactConnecting ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Connecting…</> : 'Connect Transact'}
                        </button>
                        <p className="text-[11px] text-zinc-700 text-center font-mono">Credentials stored locally, never shared</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="px-5 py-3.5 rounded-xl border text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                  style={{ borderColor: '#1C2330' }}>
                  Back
                </button>
                <button onClick={() => setStep(3)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl text-sm transition-all hover:shadow-md hover:shadow-indigo-500/20">
                  {clients.length > 0 ? `Continue with ${clients.length} clients →` : 'Skip for now →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Step 3 of 3</p>
                <h1 className="text-3xl font-bold text-zinc-50 leading-tight">You&apos;re live.</h1>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Forward any platform statement to your address — we&apos;ll reconcile it and reply with a report in ~40 seconds.
                </p>
              </div>

              {/* Email hero */}
              <div className="rounded-2xl px-6 py-5 border" style={{ background: '#0D1117', borderColor: '#1C2330' }}>
                <p className="text-[10px] text-zinc-600 mb-3 font-mono uppercase tracking-widest">Your recon.ai address</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-indigo-300 text-base tracking-tight break-all">{emailAddress}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(emailAddress); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                    className={`shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                      copied ? 'border-emerald-600 text-emerald-400 bg-emerald-950/40' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    style={{ borderColor: copied ? undefined : '#1C2330' }}>
                    {copied ? '✓ copied' : 'copy'}
                  </button>
                </div>
              </div>

              {/* Flow */}
              <div className="space-y-3">
                {[
                  { n: '1', text: 'Platform sends you a statement', color: '#4A5568' },
                  { n: '2', text: `Forward it to ${emailAddress}`, color: '#6366f1' },
                  { n: '3', text: 'Get your reconciliation report back in ~40 seconds', color: '#10b981' },
                ].map(item => (
                  <div key={item.n} className="flex items-center gap-4 text-sm">
                    <div className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 font-mono text-xs" style={{ borderColor: item.color, color: item.color, background: `${item.color}15` }}>
                      {item.n}
                    </div>
                    <span className="text-zinc-400">{item.text}</span>
                  </div>
                ))}
              </div>

              <button onClick={finish}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl text-sm transition-all hover:shadow-md hover:shadow-indigo-500/20">
                Go to dashboard →
              </button>
              <p className="text-center text-xs text-zinc-700 font-mono">
                You can also upload statements directly from the dashboard
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return <Suspense><OnboardingInner /></Suspense>
}
