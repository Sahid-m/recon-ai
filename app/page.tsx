'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    setHasAccount(!!localStorage.getItem('recon-firm'))
  }, [])

  return (
    <main className="min-h-screen bg-[#080A0C] text-zinc-100 overflow-x-hidden">

      {/* Dot grid */}
      <div className="dot-grid fixed inset-0 pointer-events-none" />

      {/* Top glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(99,102,241,0.07) 0%, transparent 65%)' }} />

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-8 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <div className="w-2.5 h-2.5 rounded-sm bg-white/90" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-100 tracking-tight">recon.ai</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/chat" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono">
            Chat agent
          </Link>
          {hasAccount
            ? <Link href="/dashboard" className="text-xs font-medium px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 rounded-lg text-zinc-200 transition-colors font-mono">
                Dashboard →
              </Link>
            : <Link href="/onboarding" className="text-xs font-medium px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-all hover:shadow-md hover:shadow-indigo-500/25">
                Get started
              </Link>
          }
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-5xl mx-auto px-8 pt-16 pb-20">
        <div className="inline-flex items-center gap-2 mb-8 text-[10px] font-mono text-zinc-600 border border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          UK IFA Income Reconciliation
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-8 items-start">
          <div>
            <h1 className="text-[4.75rem] font-extrabold tracking-[-0.03em] leading-[0.92] mb-6">
              Reconcile a full<br />
              <span className="text-transparent bg-clip-text" style={{
                backgroundImage: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #6366f1 100%)'
              }}>
                month in 40s.
              </span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-md">
              Forward your platform statement to one email address. Get back a complete reconciliation with every anomaly explained by AI.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/onboarding"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-px">
                Get started free
                <span className="opacity-70">→</span>
              </Link>
              <Link href="/chat" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Try the chat agent
                <span className="text-zinc-700">→</span>
              </Link>
            </div>
          </div>

          {/* Stat panel */}
          <div className="hidden lg:flex flex-col gap-3 pt-2 shrink-0">
            {[
              { value: '40s', label: 'reconciliation', accent: 'text-indigo-400' },
              { value: '99%', label: 'auto-match', accent: 'text-emerald-400' },
              { value: '22', label: 'platforms', accent: 'text-amber-400' },
            ].map(s => (
              <div key={s.value} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-5 py-3 text-right min-w-[120px]">
                <p className={`text-2xl font-bold font-mono ${s.accent}`}>{s.value}</p>
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email demo */}
      <section className="max-w-5xl mx-auto px-8 pb-28">
        <div className="rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl shadow-black/50">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 bg-zinc-900 border-b border-zinc-800/80">
            <div className="w-3 h-3 rounded-full bg-zinc-700/80" />
            <div className="w-3 h-3 rounded-full bg-zinc-700/80" />
            <div className="w-3 h-3 rounded-full bg-zinc-700/80" />
            <div className="ml-4 flex-1 max-w-[200px] bg-zinc-800/60 rounded-md px-3 py-1 text-[10px] font-mono text-zinc-600 text-center">
              Mail — Inbox
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-zinc-800/60" style={{ background: '#0A0D11' }}>
            {/* Send */}
            <div className="p-7 space-y-5">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">You forward</p>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex gap-3 items-baseline">
                  <span className="text-zinc-700 w-14 shrink-0">To:</span>
                  <span className="text-indigo-400">hartley-partners@readmedb.com</span>
                </div>
                <div className="flex gap-3 items-baseline">
                  <span className="text-zinc-700 w-14 shrink-0">Subject:</span>
                  <span className="text-zinc-300">Fwd: Quilter Oct statement</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-3.5">
                <div className="w-9 h-9 bg-emerald-950/60 border border-emerald-900/50 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-emerald-500 text-[10px] font-mono font-bold">XLS</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-200">quilter-oct-2024.xlsx</p>
                  <p className="text-[10px] text-zinc-600 font-mono mt-0.5">847 rows · 1.2 MB</p>
                </div>
              </div>
            </div>

            {/* Reply */}
            <div className="p-7 space-y-5 bg-zinc-900/10">
              <div className="flex items-center gap-2.5">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Reply in</p>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded-full animate-pulse">
                  ● 40s
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400">
                Re: quilter-oct-2024.xlsx — reconciled ✓
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: 'Expected', v: '£482,310', c: 'text-zinc-200' },
                  { l: 'Received', v: '£481,828', c: 'text-emerald-400' },
                  { l: 'Gap',      v: '£482',     c: 'text-amber-400' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-2.5">
                    <p className="text-[9px] text-zinc-600 uppercase font-mono mb-1">{l}</p>
                    <p className={`text-xs font-mono font-bold ${c}`}>{v}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {[
                  { l: 'Auto-matched', v: '841', c: 'text-emerald-400' },
                  { l: 'Needs review', v: '4',   c: 'text-amber-400' },
                  { l: 'Unmatched',   v: '2',    c: 'text-red-400' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500 font-mono">{l}</span>
                    <span className={`font-mono font-semibold ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-8 py-20" style={{ borderTop: '1px solid #1C2330' }}>
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-12">How it works</p>
        <div className="grid grid-cols-3 gap-12">
          {[
            { n: '01', title: 'Onboard', desc: 'Upload your client list. Get a unique inbound email address for your firm in under 5 minutes.' },
            { n: '02', title: 'Forward', desc: 'Send any platform statement — Quilter, Transact, Fidelity, AJ Bell — as an email attachment.' },
            { n: '03', title: 'Report', desc: 'Every row matched, every anomaly explained in plain English. Back in 40 seconds.' },
          ].map(s => (
            <div key={s.n} className="group">
              <p className="font-mono text-xs text-zinc-700 mb-4 group-hover:text-indigo-500 transition-colors">{s.n}</p>
              <h3 className="font-semibold text-base text-zinc-100 mb-2.5">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-20" style={{ borderTop: '1px solid #1C2330' }}>
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-12">What it does</p>
        <div className="grid grid-cols-2 gap-x-20 gap-y-8">
          {[
            { title: 'Any format, zero config', desc: 'Quilter XLS, Transact CSV, Fidelity PDF. The AI reads them cold.' },
            { title: '3-tier fuzzy matching', desc: 'Auto-matched, suggested, unmatched. Nothing silently accepted under 80% confidence.' },
            { title: 'AI anomaly explanations', desc: 'Plain English reasons for every gap. Not a spreadsheet dump — a diagnosis.' },
            { title: 'Charging-without-service alerts', desc: 'Flags clients charged with no review on record for 12+ months.' },
            { title: 'Multi-attachment batch', desc: 'Three platform attachments in one email. One report back.' },
            { title: 'Live API pull', desc: 'For Transact and API-enabled platforms, income pulls automatically.' },
          ].map(f => (
            <div key={f.title}
              className="border-l-2 border-zinc-800 pl-5 hover:border-indigo-600 transition-colors duration-300 group">
              <h3 className="text-sm font-semibold text-zinc-200 mb-1.5 group-hover:text-zinc-100 transition-colors">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-8 py-20" style={{ borderTop: '1px solid #1C2330' }}>
        <div className="grid grid-cols-3 gap-10">
          {[
            { value: '40s', label: 'Average reconciliation time', sub: 'vs. 24h IFA Dataflow turnaround', c: 'text-indigo-400' },
            { value: '22/29', label: 'UK platforms with no income API', sub: 'Email is the only scalable way', c: 'text-amber-400' },
            { value: '< 5min', label: 'Setup time', sub: 'From zero to live email address', c: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label}>
              <p className={`font-mono text-4xl font-bold tracking-tight mb-2 ${s.c}`}>{s.value}</p>
              <p className="text-sm text-zinc-300 font-medium mb-1">{s.label}</p>
              <p className="text-xs text-zinc-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-8 py-20" style={{ borderTop: '1px solid #1C2330' }}>
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-12 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.07) 0%, transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Start reconciling today.</h2>
            <p className="text-zinc-400 text-sm mb-8 max-w-sm leading-relaxed">
              Setup takes 5 minutes. Forward your next statement and see the report come back.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/onboarding"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-px">
                Get started free →
              </Link>
              <Link href="/chat" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Chat with the agent first
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-8 py-8 flex items-center justify-between text-xs text-zinc-600 font-mono"
        style={{ borderTop: '1px solid #1C2330' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-sm bg-indigo-500" />
          </div>
          <span>recon.ai</span>
        </div>
        <div className="flex gap-6">
          <Link href="/chat" className="hover:text-zinc-300 transition-colors">Chat</Link>
          <Link href="/admin" className="hover:text-zinc-300 transition-colors">Admin</Link>
          <Link href="/onboarding" className="hover:text-zinc-300 transition-colors">Get started</Link>
        </div>
        <span>HackLondon 2026</span>
      </footer>

    </main>
  )
}
