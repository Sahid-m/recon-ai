import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Client data ──────────────────────────────────────────────────────────────

const PLATFORMS = ['Quilter', 'Transact', 'Fidelity', 'AJ Bell', 'Aegon']

const FIRST_NAMES = ['James','Margaret','David','Sarah','Robert','Patricia','Thomas','Jennifer','Charles','Amanda','William','Helen','Michael','Susan','Geoffrey','Catherine','Richard','Elizabeth','Jonathan','Diana','Andrew','Frances','Peter','Caroline','Nicholas','Victoria','Simon','Rebecca','Edward','Charlotte','Mark','Harriet','Philip','Alexandra','Timothy','Rosalind','Christopher','Josephine','Benjamin','Natalie','Alexander','Sophia','Oliver','Isabella','Henry','Eleanor','George','Arabella','Frederick','Penelope']
const LAST_NAMES  = ['Hargreaves','Thornton','Patel','Wentworth','Ashworth','Newcombe','Ellison','Blackwood','Pemberton','Forsythe','Garside','Cartwright','Drummond','Whitfield','Stanton','Lowe','Fernsby','Moorfield','Barker','Whitmore','Fletcher','Hartley','Goodwin','Sutton','Lawson','Griffiths','Holt','Shepherd','Cunningham','Bryant','Morrison','Stephenson','Fowler','Pearson','Newton','Chapman','Russell','Ward','Hughes','Price','Walters','Dixon','Montgomery','Sinclair','Lockwood','Tanner','Barlow','Hayward','Ingram','Fitzgerald']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function makePlanNumber(platform, idx) {
  const prefixes = { Quilter: 'QU', Transact: 'TR', Fidelity: 'FI', 'AJ Bell': 'AJ', Aegon: 'AE' }
  return `${prefixes[platform]}-${String(100000 + idx).slice(1)}`
}

function makeClients(count, firmSuffix) {
  const used = new Set()
  return Array.from({ length: count }, (_, i) => {
    let name
    do { name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` } while (used.has(name))
    used.add(name)
    const platform = PLATFORMS[i % PLATFORMS.length]
    const fee = Math.round((100 + Math.random() * 900) * 4) / 4 // £100–£1000, rounded to 0.25
    return {
      'Client Name': name,
      'Client ID': `${firmSuffix}${String(i + 1).padStart(3, '0')}`,
      'Plan Number': makePlanNumber(platform, 10000 + i),
      'Platform': platform,
      'Expected Monthly Fee': fee,
    }
  })
}

// Firm A — Hartley & Partners (62 clients)
const hartleyClients = makeClients(62, 'HP')
// Firm B — Meridian Wealth (64 clients)
const meridianClients = makeClients(64, 'MW')

function writeClientFile(clients, filename) {
  const ws = XLSX.utils.json_to_sheet(clients)
  ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 22 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clients')
  const outPath = join(__dirname, '../public', filename)
  XLSX.writeFile(wb, outPath)
  console.log(`Written ${clients.length} clients → ${filename}`)
}

writeClientFile(hartleyClients, 'hartley-partners-clients.xlsx')
writeClientFile(meridianClients, 'meridian-wealth-clients.xlsx')

// ─── Demo statement (Quilter, 120+ rows) ─────────────────────────────────────

const FEE_TYPES = ['Ongoing Adviser Charge', 'Trail Commission', 'Initial Adviser Charge', 'Adviser Charge - Annual Review']

function isoDate(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

// Use a mix of hartley clients (85%) + some unmatched rows (15%)
const statementRows = []

// All 62 Hartley clients get a primary row
for (const client of hartleyClients) {
  const variance = (Math.random() - 0.1) * 20
  const amount = Math.max(5, client['Expected Monthly Fee'] + variance)
  statementRows.push({
    'Client Name': client['Client Name'],
    'Plan Number': client['Plan Number'],
    'Fee Type': pick(FEE_TYPES),
    'Gross Amount': parseFloat(amount.toFixed(2)),
    'Payment Date': isoDate(Math.floor(Math.random() * 5)),
    'Platform': client['Platform'],
  })
}

// 50 Meridian clients also appear (cross-platform batch)
for (const client of meridianClients.slice(0, 50)) {
  const variance = (Math.random() - 0.1) * 15
  const amount = Math.max(5, client['Expected Monthly Fee'] + variance)
  statementRows.push({
    'Client Name': client['Client Name'],
    'Plan Number': client['Plan Number'],
    'Fee Type': pick(FEE_TYPES),
    'Gross Amount': parseFloat(amount.toFixed(2)),
    'Payment Date': isoDate(Math.floor(Math.random() * 5)),
    'Platform': client['Platform'],
  })
}

// 8 unmatched rows (unknown clients / data issues)
const unknownClients = [
  { name: 'T. Blackmore', plan: 'QU-999001' },
  { name: 'A. Sinclair', plan: 'QU-999002' },
  { name: 'Henderson Trust', plan: 'QU-999003' },
  { name: '', plan: 'QU-999004' },
  { name: 'R. Cavendish', plan: 'TR-999005' },
  { name: 'P. Rothschild', plan: 'FI-999006' },
  { name: 'Estate of J. Morrison', plan: 'AJ-999007' },
  { name: 'Whitmore & Sons Ltd', plan: 'AE-999008' },
]
for (const u of unknownClients) {
  statementRows.push({
    'Client Name': u.name,
    'Plan Number': u.plan,
    'Fee Type': pick(FEE_TYPES),
    'Gross Amount': parseFloat((50 + Math.random() * 500).toFixed(2)),
    'Payment Date': isoDate(Math.floor(Math.random() * 3)),
    'Platform': 'Quilter',
  })
}

// Shuffle
statementRows.sort(() => Math.random() - 0.5)

console.log(`\nStatement rows: ${statementRows.length}`)

// Write as CSV
const csvHeader = 'Client Name,Plan Number,Fee Type,Gross Amount,Payment Date,Platform'
const csvRows = statementRows.map(r =>
  `"${r['Client Name']}","${r['Plan Number']}","${r['Fee Type']}",${r['Gross Amount']},${r['Payment Date']},"${r['Platform']}"`
)
const csvContent = [csvHeader, ...csvRows].join('\n')
writeFileSync(join(__dirname, '../public/quilter-october-2024.csv'), csvContent)
console.log(`Written ${statementRows.length} rows → public/quilter-october-2024.csv`)

// Also write as XLSX
const ws2 = XLSX.utils.json_to_sheet(statementRows)
ws2['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb2, ws2, 'Income Statement')
XLSX.writeFile(wb2, join(__dirname, '../public/quilter-october-2024.xlsx'))
console.log(`Written ${statementRows.length} rows → public/quilter-october-2024.xlsx`)

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = statementRows.reduce((s, r) => s + r['Gross Amount'], 0)
console.log(`\nTotal statement value: £${total.toFixed(2)}`)
console.log(`Hartley & Partners total expected: £${hartleyClients.reduce((s, c) => s + c['Expected Monthly Fee'], 0).toFixed(2)}/mo`)
console.log(`Meridian Wealth total expected: £${meridianClients.reduce((s, c) => s + c['Expected Monthly Fee'], 0).toFixed(2)}/mo`)
