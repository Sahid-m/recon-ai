'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    setHasAccount(!!localStorage.getItem('recon-firm'))
  }, [])

  return (
    <main className="min-h-screen bg-white text-zinc-900 font-sans">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-4xl mx-auto">
        <span className="font-semibold text-sm tracking-tight">recon.ai</span>
        {hasAccount
          ? <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Dashboard →</Link>
          : <Link href="/onboarding" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Get started →</Link>
        }
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-20 pb-16">
        <p className="text-xs text-zinc-400 mb-5 tracking-wide">Income reconciliation for IFA firms</p>
        <h1 className="text-[3.25rem] font-bold tracking-tight leading-[1.1] mb-6 max-w-xl">
          Reconcile a full month<br />in 40 seconds.
        </h1>
        <p className="text-base text-zinc-500 leading-relaxed mb-10 max-w-md">
          Forward your platform statement to one email address. Get back a complete reconciliation report with every anomaly explained.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/onboarding" className="bg-black text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors">
            Get started free
          </Link>
          <Link href="/chat" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
            Try the chat agent →
          </Link>
        </div>
      </section>

      {/* Email demo */}
      <section className="max-w-4xl mx-auto px-8 pb-24">
        <div className="border border-zinc-200 rounded-2xl overflow-hidden text-sm">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-200" />
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-100">
            <div className="p-6 space-y-4">
              <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest">You send</p>
              <div className="space-y-1 text-xs text-zinc-500">
                <div><span className="text-zinc-300 inline-block w-14">To</span>hartley-partners@readmedb.com</div>
                <div><span className="text-zinc-300 inline-block w-14">Subject</span>Quilter Oct statement</div>
              </div>
              <div className="flex items-center gap-3 border border-zinc-100 rounded-lg p-3 bg-zinc-50">
                <div className="w-8 h-8 bg-zinc-100 rounded-md" />
                <div>
                  <p className="text-xs font-medium text-zinc-700">quilter-oct-2024.xlsx</p>
                  <p className="text-[11px] text-zinc-400">847 rows</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4 bg-zinc-50/40">
              <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest">Reply in 40s</p>
              <p className="text-xs text-zinc-600 font-medium">quilter-oct-2024.xlsx — reconciled</p>
              <div className="grid grid-cols-3 gap-2">
                {[['Expected', '£482,310'], ['Received', '£481,828'], ['Gap', '£482']].map(([l, v]) => (
                  <div key={l} className="bg-white border border-zinc-100 rounded-lg p-2.5">
                    <p className="text-[9px] text-zinc-400 uppercase mb-0.5">{l}</p>
                    <p className="text-xs font-mono font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between"><span>Auto-matched</span><span className="font-mono">841</span></div>
                <div className="flex justify-between"><span>Needs review</span><span className="font-mono">4</span></div>
                <div className="flex justify-between"><span>Unmatched</span><span className="font-mono">2</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-zinc-100 max-w-4xl mx-auto" />

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-8 py-20">
        <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mb-10">How it works</p>
        <div className="grid grid-cols-3 gap-10">
          {[
            { n: '01', title: 'Onboard', desc: 'Upload your client list. Get a unique inbound email address for your firm.' },
            { n: '02', title: 'Forward', desc: 'Send any platform statement — Quilter, Transact, Fidelity, AJ Bell — as an email attachment.' },
            { n: '03', title: 'Report', desc: 'Every row matched, every anomaly explained in plain English. Back in 40 seconds.' },
          ].map(s => (
            <div key={s.n}>
              <p className="text-xs font-mono text-zinc-300 mb-3">{s.n}</p>
              <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-zinc-100 max-w-4xl mx-auto" />

      {/* Features */}
      <section id="features" className="max-w-4xl mx-auto px-8 py-20">
        <p className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest mb-10">What it does</p>
        <div className="grid grid-cols-2 gap-x-16 gap-y-8">
          {[
            { title: 'Any format, zero config', desc: 'Quilter XLS, Transact CSV, Fidelity PDF. The AI reads them cold.' },
            { title: '3-tier fuzzy matching', desc: 'Auto-matched, suggested, unmatched. Nothing silently accepted under 80% confidence.' },
            { title: 'AI anomaly explanations', desc: 'Plain English reasons for every gap. Not a spreadsheet dump — a diagnosis.' },
            { title: 'Charging-without-service', desc: 'Flags clients charged with no review on record for 12+ months.' },
            { title: 'Multi-attachment batch', desc: 'Three platform attachments in one email. One report back.' },
            { title: 'Live API pull', desc: 'For Transact and API-enabled platforms, income pulls automatically.' },
          ].map(f => (
            <div key={f.title}>
              <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-zinc-100 max-w-4xl mx-auto" />

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-8 py-20 grid grid-cols-3 gap-10">
        {[
          { value: '40s', label: 'Avg reconciliation time' },
          { value: '22 / 29', label: 'UK platforms with no income API' },
          { value: '24h', label: 'IFA Dataflow turnaround' },
        ].map(s => (
          <div key={s.label}>
            <p className="text-3xl font-bold tracking-tight mb-1.5">{s.value}</p>
            <p className="text-sm text-zinc-500">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="h-px bg-zinc-100 max-w-4xl mx-auto" />

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Try it now.</h2>
        <p className="text-zinc-500 text-sm mb-8 max-w-sm leading-relaxed">
          Setup takes 5 minutes. Forward your next statement and see the report.
        </p>
        <Link href="/onboarding" className="inline-block bg-black text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors">
          Get started free →
        </Link>
      </section>

      {/* Footer */}
      <div className="h-px bg-zinc-100 max-w-4xl mx-auto" />
      <footer className="max-w-4xl mx-auto px-8 py-6 flex items-center justify-between text-xs text-zinc-400">
        <span>recon.ai</span>
        <div className="flex gap-5">
          <Link href="/chat" className="hover:text-zinc-700 transition-colors">Chat</Link>
          <Link href="/admin" className="hover:text-zinc-700 transition-colors">Admin</Link>
          <Link href="/onboarding" className="hover:text-zinc-700 transition-colors">Get started</Link>
        </div>
        <span>HackLondon 2026</span>
      </footer>

    </main>
  )
}
