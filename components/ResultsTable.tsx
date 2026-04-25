import type { ValidatedRow } from '../lib/schema'

function badge(confidence: number) {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.7) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function label(confidence: number) {
  if (confidence >= 0.8) return 'Auto-matched'
  if (confidence >= 0.7) return 'Review'
  return 'Flagged'
}

export function ResultsTable({ rows }: { rows: ValidatedRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm p-4">No rows to display.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Client', 'Plan No.', 'Fee Type', 'Amount', 'Date', 'Platform', 'Status'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-2">{row.clientName}</td>
              <td className="px-4 py-2 font-mono text-xs text-gray-500">{row.planNumber}</td>
              <td className="px-4 py-2 text-gray-600">{row.feeType}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                £{row.grossAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2 text-gray-500">{row.paymentDate}</td>
              <td className="px-4 py-2 text-gray-600">{row.platformName}</td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge(row.confidence)}`}>
                  {label(row.confidence)} {Math.round(row.confidence * 100)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
