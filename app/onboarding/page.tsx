'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface ClientRecord {
  name: string
  clientId: string
  planNumber: string
  platform: string
  expectedMonthlyFee: number
}

const CRM_OPTIONS = [
  { id: 'intelliflo', name: 'Intelliflo', logo: '🔷', desc: 'OAuth connection' },
  { id: 'xplan', name: 'Xplan', logo: '🟦', desc: 'API key' },
  { id: 'salesforce', name: 'Salesforce', logo: '☁️', desc: 'OAuth connection' },
  { id: 'dynamics', name: 'Dynamics 365', logo: '🪟', desc: 'OAuth connection' },
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
]

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [firmName, setFirmName] = useState('')
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [importError, setImportError] = useState('')
  const [importMethod, setImportMethod] = useState<'crm' | 'excel' | null>(null)
  const [connectingCrm, setConnectingCrm] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const handleFile = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
        const parsed: ClientRecord[] = rows.map(r => ({
          name: String(r['Client Name'] ?? r['Name'] ?? r['name'] ?? ''),
          clientId: String(r['Client ID'] ?? r['ClientID'] ?? ''),
          planNumber: String(r['Plan Number'] ?? r['Plan No'] ?? r['planNumber'] ?? ''),
          platform: String(r['Platform'] ?? r['platform'] ?? ''),
          expectedMonthlyFee: Number(r['Expected Monthly Fee'] ?? r['Monthly Fee'] ?? r['fee'] ?? 0),
        })).filter(r => r.name)

        if (parsed.length === 0) {
          setImportError('No clients found — check your column headers match the template.')
          return
        }
        setClients(parsed)
      } catch {
        setImportError('Could not read file. Download the template and try again.')
      }
    }
    reader.readAsArrayBuffer(file)
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

  const finish = async () => {
    localStorage.setItem('recon-firm', JSON.stringify({
      firmName, clients, emailAddress, setupAt: Date.now(),
      transactConnected,
      ...(transactConnected ? { transactAdviserId } : {}),
    }))

    // Seed ReadmeDB with firm file so email handler can find clients
    if (clients.length > 0) {
      try {
        await fetch('/api/seed-firm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firmName, clients, emailAddress }),
        })
      } catch { /* non-fatal */ }
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">readmedb.com</span>
        </div>
        <span className="text-xs text-gray-400">Step {step} of 3</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">

          {/* Step 1 — Firm name */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Step 1 of 3</p>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                  What&apos;s your firm called?
                </h1>
                <p className="text-gray-500">
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
                className="w-full text-xl border-0 border-b-2 border-gray-200 focus:border-black outline-none pb-3 placeholder-gray-300 transition-colors bg-transparent text-gray-900"
              />

              {firmName.trim() && (
                <p className="text-sm text-gray-400">
                  Your address will be{' '}
                  <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{emailAddress}</span>
                </p>
              )}

              <button
                onClick={() => setStep(2)}
                disabled={!firmName.trim()}
                className="w-full bg-black text-white font-medium py-3.5 rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2 — Client import */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Step 2 of 3</p>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                  Import your clients
                </h1>
                <p className="text-gray-500">
                  We match income against this to catch missing or wrong payments.
                </p>
              </div>

              {clients.length === 0 ? (
                <div className="space-y-3">
                  {/* CRM connect */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setImportMethod(importMethod === 'crm' ? null : 'crm')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🔗</span>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">Connect your CRM</p>
                          <p className="text-xs text-gray-400">Intelliflo, Xplan, Salesforce, Dynamics</p>
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm">{importMethod === 'crm' ? '▴' : '▾'}</span>
                    </button>

                    {importMethod === 'crm' && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {CRM_OPTIONS.map(crm => (
                          <button
                            key={crm.id}
                            onClick={() => {
                              setConnectingCrm(crm.id)
                              setTimeout(() => {
                                setConnectingCrm(null)
                                setClients(DEMO_CLIENTS)
                              }, 2200)
                            }}
                            disabled={!!connectingCrm}
                            className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-60"
                          >
                            <span className="text-xl w-7 text-center">{crm.logo}</span>
                            <div className="text-left flex-1">
                              <p className="text-sm font-medium text-gray-800">{crm.name}</p>
                              <p className="text-xs text-gray-400">{crm.desc}</p>
                            </div>
                            {connectingCrm === crm.id ? (
                              <div className="flex items-center gap-2 text-xs text-blue-500">
                                <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                Connecting…
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 border border-gray-200 px-3 py-1 rounded-lg hover:border-gray-300 transition-colors">
                                Connect
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Excel upload */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setImportMethod(importMethod === 'excel' ? null : 'excel')}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📂</span>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">Upload Excel / CSV</p>
                          <p className="text-xs text-gray-400">Or download our template to get started</p>
                        </div>
                      </div>
                      <span className="text-gray-300 text-sm">{importMethod === 'excel' ? '▴' : '▾'}</span>
                    </button>

                    {importMethod === 'excel' && (
                      <div className="border-t border-gray-100 p-4 space-y-3">
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                          onClick={() => fileRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                            dragOver ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="text-sm text-gray-600">Drop file here or click to browse</p>
                          <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
                        </div>
                        {importError && <p className="text-sm text-red-500">{importError}</p>}
                        <button onClick={downloadTemplate} className="w-full text-xs text-gray-400 hover:text-gray-700 py-2 transition-colors">
                          Download template ↓
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Demo shortcut */}
                  <button
                    onClick={() => setClients(DEMO_CLIENTS)}
                    className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
                  >
                    Use demo client data →
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-base shrink-0">
                    {clients.length}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{clients.length} clients imported</p>
                    <p className="text-sm text-gray-500 truncate">
                      {clients.slice(0, 3).map(c => c.name.split(' ')[0]).join(', ')}{clients.length > 3 ? ` + ${clients.length - 3} more` : ''}
                    </p>
                  </div>
                  <button onClick={() => { setClients([]); setImportMethod(null) }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 transition-colors">
                    Change
                  </button>
                </div>
              )}

              {/* Optional: Connect Transact API */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowTransact(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Connect Transact API <span className="ml-1.5 text-[10px] font-mono text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">optional</span></p>
                      <p className="text-xs text-gray-400">Pull income automatically — no statement forwarding needed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {transactConnected && <span className="text-[10px] font-mono text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">● Connected</span>}
                    <span className="text-gray-300 text-sm">{showTransact ? '▴' : '▾'}</span>
                  </div>
                </button>

                {showTransact && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {transactConnected ? (
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        <span className="text-green-600 text-lg">✅</span>
                        <div>
                          <p className="text-sm font-semibold text-green-800">Transact connected</p>
                          <p className="text-xs text-green-600">Adviser ID: {transactAdviserId} — income will pull automatically</p>
                        </div>
                        <button onClick={() => { setTransactConnected(false); setTransactAdviserId(''); setTransactApiKey('') }} className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors">Disconnect</button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={transactAdviserId}
                          onChange={e => setTransactAdviserId(e.target.value)}
                          placeholder="Adviser ID (e.g. ADV-12345)"
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black transition-colors placeholder-gray-300"
                        />
                        <input
                          type="password"
                          value={transactApiKey}
                          onChange={e => setTransactApiKey(e.target.value)}
                          placeholder="API Key"
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-black transition-colors placeholder-gray-300"
                        />
                        <button
                          onClick={connectTransact}
                          disabled={!transactAdviserId.trim() || !transactApiKey.trim() || transactConnecting}
                          className="w-full flex items-center justify-center gap-2 bg-black text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                        >
                          {transactConnecting ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Connecting…
                            </>
                          ) : 'Connect Transact'}
                        </button>
                        <p className="text-[11px] text-gray-400 text-center">Your credentials are stored locally and never shared</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-black text-white font-medium py-3.5 rounded-xl text-sm hover:bg-gray-800 transition-colors"
                >
                  {clients.length > 0 ? `Continue with ${clients.length} clients` : 'Skip for now'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — The magic moment */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Step 3 of 3</p>
                <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                  You&apos;re done.
                </h1>
                <p className="text-gray-500">
                  This is your email address. Forward any platform statement to it — we&apos;ll reconcile it and reply with a report.
                </p>
              </div>

              {/* The email — hero moment */}
              <div className="bg-gray-950 rounded-2xl px-6 py-5">
                <p className="text-xs text-gray-500 mb-2 font-mono">YOUR RECON AI ADDRESS</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-white text-lg tracking-tight break-all">{emailAddress}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(emailAddress)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className={`shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                      copied
                        ? 'border-green-500 text-green-400 bg-green-950/40'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {copied ? '✓ copied' : 'copy'}
                  </button>
                </div>
              </div>

              {/* 3-step mini flow */}
              <div className="space-y-3">
                {[
                  { icon: '📨', text: 'Platform emails you a statement' },
                  { icon: '↩️', text: `You forward it to ${emailAddress}` },
                  { icon: '📊', text: 'We reply with your reconciliation report in ~40 seconds' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="text-xl w-8 text-center shrink-0">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={finish}
                className="w-full bg-black text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-gray-800 transition-colors"
              >
                Go to dashboard →
              </button>

              <p className="text-center text-xs text-gray-400">
                You can also upload statements directly from the dashboard
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
