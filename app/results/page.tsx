'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ResultsTable } from '../../components/ResultsTable'
import type { ValidatedRow } from '../../lib/schema'

export default function ResultsPage() {
  const [rows, setRows] = useState<ValidatedRow[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const raw = sessionStorage.getItem('recon-results')
    if (!raw) { router.push('/'); return }
    const data = JSON.parse(raw)
    if (!data.success && data.error) setError(data.error)
    setRows(data.rows ?? [])
  }, [router])

  const total = rows.reduce((sum, r) => sum + r.grossAmount, 0)
  const autoMatched = rows.filter((r) => r.confidence >= 0.8).length
  const needsReview = rows.filter((r) => r.confidence >= 0.7 && r.confidence < 0.8).length
  const flagged = rows.filter((r) => r.confidence < 0.7).length

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Reconciliation Results</h1>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-blue-600 hover:underline"
          >
            Upload another statement
          </button>
        </div>

        {error && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total rows</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-100 p-4">
            <p className="text-xs text-green-600 uppercase tracking-wide">Auto-matched</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{autoMatched}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <p className="text-xs text-amber-600 uppercase tracking-wide">Needs review</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{needsReview}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 p-4">
            <p className="text-xs text-red-600 uppercase tracking-wide">Flagged</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{flagged}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total reconciled</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            £{total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-xl border">
          <ResultsTable rows={rows} />
        </div>
      </div>
    </main>
  )
}
