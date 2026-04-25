import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

// ── Meridian Wealth Management — 42 clients across 3 platforms ───────────────

const clients = [
  // Quilter clients (20)
  { 'Client Name': 'Jonathan Whitfield',    'Client ID': 'MW001', 'Plan Number': 'QU-112001', 'Platform': 'Quilter',   'Expected Monthly Fee': 875.00,  'Last Review Date': '2024-03-14' },
  { 'Client Name': 'Susan Hartley',         'Client ID': 'MW002', 'Plan Number': 'QU-112002', 'Platform': 'Quilter',   'Expected Monthly Fee': 420.00,  'Last Review Date': '2024-07-22' },
  { 'Client Name': 'Robert Fleming',        'Client ID': 'MW003', 'Plan Number': 'QU-112003', 'Platform': 'Quilter',   'Expected Monthly Fee': 1100.00, 'Last Review Date': '2024-09-01' },
  { 'Client Name': 'Catherine Brooks',      'Client ID': 'MW004', 'Plan Number': 'QU-112004', 'Platform': 'Quilter',   'Expected Monthly Fee': 310.00,  'Last Review Date': '2024-01-10' },
  { 'Client Name': 'Michael Davenport',     'Client ID': 'MW005', 'Plan Number': 'QU-112005', 'Platform': 'Quilter',   'Expected Monthly Fee': 650.00,  'Last Review Date': '2024-08-30' },
  { 'Client Name': 'Amanda Worthington',    'Client ID': 'MW006', 'Plan Number': 'QU-112006', 'Platform': 'Quilter',   'Expected Monthly Fee': 485.00,  'Last Review Date': '2024-06-15' },
  { 'Client Name': 'Peter Ashdown',         'Client ID': 'MW007', 'Plan Number': 'QU-112007', 'Platform': 'Quilter',   'Expected Monthly Fee': 720.00,  'Last Review Date': '2024-02-28' },
  { 'Client Name': 'Helen Cartwright',      'Client ID': 'MW008', 'Plan Number': 'QU-112008', 'Platform': 'Quilter',   'Expected Monthly Fee': 195.00,  'Last Review Date': '2024-09-19' },
  { 'Client Name': 'David Moorfield',       'Client ID': 'MW009', 'Plan Number': 'QU-112009', 'Platform': 'Quilter',   'Expected Monthly Fee': 540.00,  'Last Review Date': '2024-05-03' },
  { 'Client Name': 'Patricia Sinclair',     'Client ID': 'MW010', 'Plan Number': 'QU-112010', 'Platform': 'Quilter',   'Expected Monthly Fee': 380.00,  'Last Review Date': '2023-11-12' },
  { 'Client Name': 'Thomas Huntingdon',     'Client ID': 'MW011', 'Plan Number': 'QU-112011', 'Platform': 'Quilter',   'Expected Monthly Fee': 925.00,  'Last Review Date': '2024-07-07' },
  { 'Client Name': 'Elizabeth Norwood',     'Client ID': 'MW012', 'Plan Number': 'QU-112012', 'Platform': 'Quilter',   'Expected Monthly Fee': 260.00,  'Last Review Date': '2024-08-11' },
  { 'Client Name': 'James Pendleton',       'Client ID': 'MW013', 'Plan Number': 'QU-112013', 'Platform': 'Quilter',   'Expected Monthly Fee': 1350.00, 'Last Review Date': '2024-09-25' },
  { 'Client Name': 'Caroline Forsythe',     'Client ID': 'MW014', 'Plan Number': 'QU-112014', 'Platform': 'Quilter',   'Expected Monthly Fee': 445.00,  'Last Review Date': '2024-04-18' },
  { 'Client Name': 'Richard Blackmore',     'Client ID': 'MW015', 'Plan Number': 'QU-112015', 'Platform': 'Quilter',   'Expected Monthly Fee': 610.00,  'Last Review Date': '2024-08-05' },
  { 'Client Name': 'Victoria Pemberton',    'Client ID': 'MW016', 'Plan Number': 'QU-112016', 'Platform': 'Quilter',   'Expected Monthly Fee': 330.00,  'Last Review Date': '2023-09-30' },
  { 'Client Name': 'Andrew Gloucester',     'Client ID': 'MW017', 'Plan Number': 'QU-112017', 'Platform': 'Quilter',   'Expected Monthly Fee': 780.00,  'Last Review Date': '2024-07-14' },
  { 'Client Name': 'Frances Whitmore',      'Client ID': 'MW018', 'Plan Number': 'QU-112018', 'Platform': 'Quilter',   'Expected Monthly Fee': 415.00,  'Last Review Date': '2024-09-08' },
  { 'Client Name': 'George Thornbury',      'Client ID': 'MW019', 'Plan Number': 'QU-112019', 'Platform': 'Quilter',   'Expected Monthly Fee': 550.00,  'Last Review Date': '2024-06-22' },
  { 'Client Name': 'Harriet Dunmore',       'Client ID': 'MW020', 'Plan Number': 'QU-112020', 'Platform': 'Quilter',   'Expected Monthly Fee': 290.00,  'Last Review Date': '2024-08-17' },

  // Transact clients (14)
  { 'Client Name': 'Charles Worthington',   'Client ID': 'MW021', 'Plan Number': 'TR-220101', 'Platform': 'Transact',  'Expected Monthly Fee': 1200.00, 'Last Review Date': '2024-09-12' },
  { 'Client Name': 'Diana Ashworth',        'Client ID': 'MW022', 'Plan Number': 'TR-220102', 'Platform': 'Transact',  'Expected Monthly Fee': 560.00,  'Last Review Date': '2024-07-31' },
  { 'Client Name': 'Edward Collingwood',    'Client ID': 'MW023', 'Plan Number': 'TR-220103', 'Platform': 'Transact',  'Expected Monthly Fee': 890.00,  'Last Review Date': '2024-08-20' },
  { 'Client Name': 'Fiona Castleton',       'Client ID': 'MW024', 'Plan Number': 'TR-220104', 'Platform': 'Transact',  'Expected Monthly Fee': 345.00,  'Last Review Date': '2024-03-05' },
  { 'Client Name': 'Graham Willoughby',     'Client ID': 'MW025', 'Plan Number': 'TR-220105', 'Platform': 'Transact',  'Expected Monthly Fee': 975.00,  'Last Review Date': '2024-09-18' },
  { 'Client Name': 'Hannah Beaumont',       'Client ID': 'MW026', 'Plan Number': 'TR-220106', 'Platform': 'Transact',  'Expected Monthly Fee': 410.00,  'Last Review Date': '2024-06-28' },
  { 'Client Name': 'Ian Crompton',          'Client ID': 'MW027', 'Plan Number': 'TR-220107', 'Platform': 'Transact',  'Expected Monthly Fee': 680.00,  'Last Review Date': '2023-10-15' },
  { 'Client Name': 'Julia Ravenswood',      'Client ID': 'MW028', 'Plan Number': 'TR-220108', 'Platform': 'Transact',  'Expected Monthly Fee': 225.00,  'Last Review Date': '2024-08-02' },
  { 'Client Name': 'Kenneth Alderton',      'Client ID': 'MW029', 'Plan Number': 'TR-220109', 'Platform': 'Transact',  'Expected Monthly Fee': 1450.00, 'Last Review Date': '2024-09-05' },
  { 'Client Name': 'Laura Standish',        'Client ID': 'MW030', 'Plan Number': 'TR-220110', 'Platform': 'Transact',  'Expected Monthly Fee': 395.00,  'Last Review Date': '2024-07-09' },
  { 'Client Name': 'Martin Elsworth',       'Client ID': 'MW031', 'Plan Number': 'TR-220111', 'Platform': 'Transact',  'Expected Monthly Fee': 810.00,  'Last Review Date': '2024-09-22' },
  { 'Client Name': 'Natasha Hollingsworth', 'Client ID': 'MW032', 'Plan Number': 'TR-220112', 'Platform': 'Transact',  'Expected Monthly Fee': 465.00,  'Last Review Date': '2024-04-30' },
  { 'Client Name': 'Oliver Stratford',      'Client ID': 'MW033', 'Plan Number': 'TR-220113', 'Platform': 'Transact',  'Expected Monthly Fee': 1050.00, 'Last Review Date': '2024-08-26' },
  { 'Client Name': 'Pamela Westhampton',    'Client ID': 'MW034', 'Plan Number': 'TR-220114', 'Platform': 'Transact',  'Expected Monthly Fee': 320.00,  'Last Review Date': '2024-05-14' },

  // Fidelity clients (8)
  { 'Client Name': 'Quentin Ashby',         'Client ID': 'MW035', 'Plan Number': 'FI-330501', 'Platform': 'Fidelity',  'Expected Monthly Fee': 740.00,  'Last Review Date': '2024-09-03' },
  { 'Client Name': 'Rebecca Dunstan',       'Client ID': 'MW036', 'Plan Number': 'FI-330502', 'Platform': 'Fidelity',  'Expected Monthly Fee': 285.00,  'Last Review Date': '2024-07-16' },
  { 'Client Name': 'Simon Weatherby',       'Client ID': 'MW037', 'Plan Number': 'FI-330503', 'Platform': 'Fidelity',  'Expected Monthly Fee': 1100.00, 'Last Review Date': '2024-08-08' },
  { 'Client Name': 'Teresa Montague',       'Client ID': 'MW038', 'Plan Number': 'FI-330504', 'Platform': 'Fidelity',  'Expected Monthly Fee': 495.00,  'Last Review Date': '2024-09-27' },
  { 'Client Name': 'Ulric Pemberton',       'Client ID': 'MW039', 'Plan Number': 'FI-330505', 'Platform': 'Fidelity',  'Expected Monthly Fee': 625.00,  'Last Review Date': '2024-06-11' },
  { 'Client Name': 'Vivienne Caldwell',     'Client ID': 'MW040', 'Plan Number': 'FI-330506', 'Platform': 'Fidelity',  'Expected Monthly Fee': 350.00,  'Last Review Date': '2023-12-20' },
  { 'Client Name': 'Walter Kingsley',       'Client ID': 'MW041', 'Plan Number': 'FI-330507', 'Platform': 'Fidelity',  'Expected Monthly Fee': 890.00,  'Last Review Date': '2024-08-29' },
  { 'Client Name': 'Yvonne Stafford',       'Client ID': 'MW042', 'Plan Number': 'FI-330508', 'Platform': 'Fidelity',  'Expected Monthly Fee': 420.00,  'Last Review Date': '2024-07-03' },
]

// ── Quilter statement (October 2024) ─────────────────────────────────────────
// 17 auto-matched, 1 fuzzy/suggested, 1 wrong amount, 1 unknown, 1 missing
const quilterRows = [
  { 'Client Name': 'Jonathan Whitfield',  'Plan Number': 'QU-112001', 'Fee Type': 'Adviser Charge', 'Gross Amount': 875.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Susan Hartley',       'Plan Number': 'QU-112002', 'Fee Type': 'Adviser Charge', 'Gross Amount': 420.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Robert Fleming',      'Plan Number': 'QU-112003', 'Fee Type': 'Adviser Charge', 'Gross Amount': 1100.00, 'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Catherine Brooks',    'Plan Number': 'QU-112004', 'Fee Type': 'Adviser Charge', 'Gross Amount': 310.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Michael Davenport',   'Plan Number': 'QU-112005', 'Fee Type': 'Adviser Charge', 'Gross Amount': 650.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Amanda Worthington',  'Plan Number': 'QU-112006', 'Fee Type': 'Adviser Charge', 'Gross Amount': 485.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Peter Ashdown',       'Plan Number': 'QU-112007', 'Fee Type': 'Adviser Charge', 'Gross Amount': 720.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Helen Cartwright',    'Plan Number': 'QU-112008', 'Fee Type': 'Adviser Charge', 'Gross Amount': 195.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'David Moorfield',     'Plan Number': 'QU-112009', 'Fee Type': 'Adviser Charge', 'Gross Amount': 540.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Patricia Sinclair',   'Plan Number': 'QU-112010', 'Fee Type': 'Adviser Charge', 'Gross Amount': 380.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' }, // CWS: no review since Nov 2023
  { 'Client Name': 'Thomas Huntingdon',   'Plan Number': 'QU-112011', 'Fee Type': 'Adviser Charge', 'Gross Amount': 925.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Elizabeth Norwood',   'Plan Number': 'QU-112012', 'Fee Type': 'Adviser Charge', 'Gross Amount': 260.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'James Pendleton',     'Plan Number': 'QU-112013', 'Fee Type': 'Adviser Charge', 'Gross Amount': 1350.00, 'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Caroline Forsythe',   'Plan Number': 'QU-112014', 'Fee Type': 'Adviser Charge', 'Gross Amount': 445.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Richard Blackmore',   'Plan Number': 'QU-112015', 'Fee Type': 'Adviser Charge', 'Gross Amount': 610.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  // CWS flag — no review since Sep 2023, still being charged
  { 'Client Name': 'Victoria Pemberton',  'Plan Number': 'QU-112016', 'Fee Type': 'Adviser Charge', 'Gross Amount': 330.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Andrew Gloucester',   'Plan Number': 'QU-112017', 'Fee Type': 'Adviser Charge', 'Gross Amount': 780.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  { 'Client Name': 'Frances Whitmore',    'Plan Number': 'QU-112018', 'Fee Type': 'Adviser Charge', 'Gross Amount': 415.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  // Wrong amount — paid £490 instead of £550
  { 'Client Name': 'George Thornbury',    'Plan Number': 'QU-112019', 'Fee Type': 'Adviser Charge', 'Gross Amount': 490.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  // Slightly wrong name — fuzzy match
  { 'Client Name': 'H Dunmore',           'Plan Number': 'QU-112020', 'Fee Type': 'Adviser Charge', 'Gross Amount': 290.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  // Unknown client — unmatched
  { 'Client Name': 'Derek Fotheringay',   'Plan Number': 'QU-119999', 'Fee Type': 'Adviser Charge', 'Gross Amount': 510.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter', 'Status': 'Paid' },
  // George Thornbury already above; Harriet Dunmore (MW020) appears as "H Dunmore" above (suggested match)
]

// ── Transact statement (October 2024) ────────────────────────────────────────
// 12 auto-matched, 1 wrong amount, 1 missing (Oliver Stratford)
const transactRows = [
  { 'Client Name': 'Charles Worthington',   'Plan Number': 'TR-220101', 'Fee Type': 'Adviser Charge', 'Gross Amount': 1200.00, 'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Diana Ashworth',        'Plan Number': 'TR-220102', 'Fee Type': 'Adviser Charge', 'Gross Amount': 560.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Edward Collingwood',    'Plan Number': 'TR-220103', 'Fee Type': 'Adviser Charge', 'Gross Amount': 890.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Fiona Castleton',       'Plan Number': 'TR-220104', 'Fee Type': 'Adviser Charge', 'Gross Amount': 345.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Graham Willoughby',     'Plan Number': 'TR-220105', 'Fee Type': 'Adviser Charge', 'Gross Amount': 975.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Hannah Beaumont',       'Plan Number': 'TR-220106', 'Fee Type': 'Adviser Charge', 'Gross Amount': 410.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Ian Crompton',          'Plan Number': 'TR-220107', 'Fee Type': 'Adviser Charge', 'Gross Amount': 680.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' }, // CWS flag
  { 'Client Name': 'Julia Ravenswood',      'Plan Number': 'TR-220108', 'Fee Type': 'Adviser Charge', 'Gross Amount': 225.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Kenneth Alderton',      'Plan Number': 'TR-220109', 'Fee Type': 'Adviser Charge', 'Gross Amount': 1450.00, 'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Laura Standish',        'Plan Number': 'TR-220110', 'Fee Type': 'Adviser Charge', 'Gross Amount': 395.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Martin Elsworth',       'Plan Number': 'TR-220111', 'Fee Type': 'Adviser Charge', 'Gross Amount': 810.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  // Wrong amount — paid £390 instead of £465
  { 'Client Name': 'Natasha Hollingsworth', 'Plan Number': 'TR-220112', 'Fee Type': 'Adviser Charge', 'Gross Amount': 390.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  { 'Client Name': 'Pamela Westhampton',    'Plan Number': 'TR-220114', 'Fee Type': 'Adviser Charge', 'Gross Amount': 320.00,  'Payment Date': '2024-10-31', 'Platform': 'Transact', 'Adviser': 'D. Meridian' },
  // Oliver Stratford (TR-220113, £1050) — missing this month, no payment received
]

// ── Fidelity statement (October 2024) ────────────────────────────────────────
// 7 auto-matched, 1 wrong plan number
const fidelityRows = [
  { 'Investor Name': 'Quentin Ashby',      'Policy Number': 'FI-330501', 'Transaction Type': 'Adviser Fee', 'Net Amount': 740.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'ISA' },
  { 'Investor Name': 'Rebecca Dunstan',    'Policy Number': 'FI-330502', 'Transaction Type': 'Adviser Fee', 'Net Amount': 285.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'GIA' },
  { 'Investor Name': 'Simon Weatherby',    'Policy Number': 'FI-330503', 'Transaction Type': 'Adviser Fee', 'Net Amount': 1100.00, 'Transaction Date': '31-Oct-2024', 'Wrapper': 'SIPP' },
  { 'Investor Name': 'Teresa Montague',    'Policy Number': 'FI-330504', 'Transaction Type': 'Adviser Fee', 'Net Amount': 495.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'ISA' },
  { 'Investor Name': 'Ulric Pemberton',    'Policy Number': 'FI-330505', 'Transaction Type': 'Adviser Fee', 'Net Amount': 625.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'GIA' },
  // CWS flag — no review since Dec 2023
  { 'Investor Name': 'Vivienne Caldwell',  'Policy Number': 'FI-330506', 'Transaction Type': 'Adviser Fee', 'Net Amount': 350.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'ISA' },
  { 'Investor Name': 'Walter Kingsley',    'Policy Number': 'FI-330507', 'Transaction Type': 'Adviser Fee', 'Net Amount': 890.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'SIPP' },
  // Wrong plan number (off by one digit) — suggested match
  { 'Investor Name': 'Yvonne Stafford',    'Policy Number': 'FI-330509', 'Transaction Type': 'Adviser Fee', 'Net Amount': 420.00,  'Transaction Date': '31-Oct-2024', 'Wrapper': 'GIA' },
]

// ── Write client list ─────────────────────────────────────────────────────────
const clientWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(clientWb, XLSX.utils.json_to_sheet(clients), 'Clients')
XLSX.writeFile(clientWb, 'public/demo/meridian-wealth-clients.xlsx')
console.log('✅ Written: public/meridian-wealth-clients.xlsx (42 clients)')

// ── Write Quilter statement ───────────────────────────────────────────────────
const quilterWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(quilterWb, XLSX.utils.json_to_sheet(quilterRows), 'Non-Pension')
XLSX.utils.book_append_sheet(quilterWb, XLSX.utils.json_to_sheet([]), 'Pension')
XLSX.writeFile(quilterWb, 'public/demo/quilter-meridian-oct-2024.xlsx')
console.log('✅ Written: public/quilter-meridian-oct-2024.xlsx (21 rows)')

// ── Write Transact statement ──────────────────────────────────────────────────
const transactWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(transactWb, XLSX.utils.json_to_sheet(transactRows), 'Income')
XLSX.writeFile(transactWb, 'public/demo/transact-meridian-oct-2024.xlsx')
console.log('✅ Written: public/transact-meridian-oct-2024.xlsx (13 rows)')

// ── Write Fidelity statement ──────────────────────────────────────────────────
const fidelityWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(fidelityWb, XLSX.utils.json_to_sheet(fidelityRows), 'Transactions')
XLSX.writeFile(fidelityWb, 'public/demo/fidelity-meridian-oct-2024.xlsx')
console.log('✅ Written: public/fidelity-meridian-oct-2024.xlsx (8 rows)')

// ── Summary ───────────────────────────────────────────────────────────────────
const quilterExpected = clients.filter(c => c['Platform'] === 'Quilter').reduce((s, c) => s + c['Expected Monthly Fee'], 0)
const quilterReceived = quilterRows.reduce((s, r) => s + r['Gross Amount'], 0)
const transactExpected = clients.filter(c => c['Platform'] === 'Transact').reduce((s, c) => s + c['Expected Monthly Fee'], 0)
const transactReceived = transactRows.reduce((s, r) => s + r['Gross Amount'], 0)
const fidelityExpected = clients.filter(c => c['Platform'] === 'Fidelity').reduce((s, c) => s + c['Expected Monthly Fee'], 0)
const fidelityReceived = fidelityRows.reduce((s, r) => s + r['Net Amount'], 0)

console.log('\n📊 Expected outcomes:')
console.log('\nQuilter:')
console.log(`  Expected: £${quilterExpected.toFixed(2)} | Received: £${quilterReceived.toFixed(2)} | Gap: £${(quilterExpected - quilterReceived).toFixed(2)}`)
console.log('  ✅ Auto-matched: ~18 | 🟡 Suggested: 1 (H Dunmore) | 🔴 Unmatched: 1 (Derek Fotheringay) | ⚠️ Wrong amount: George Thornbury (£60 short)')
console.log('\nTransact:')
console.log(`  Expected: £${transactExpected.toFixed(2)} | Received: £${transactReceived.toFixed(2)} | Gap: £${(transactExpected - transactReceived).toFixed(2)}`)
console.log('  ✅ Auto-matched: ~12 | 🔴 Missing: Oliver Stratford (£1050) | ⚠️ Wrong amount: Natasha Hollingsworth (£75 short)')
console.log('\nFidelity:')
console.log(`  Expected: £${fidelityExpected.toFixed(2)} | Received: £${fidelityReceived.toFixed(2)} | Gap: £${(fidelityExpected - fidelityReceived).toFixed(2)}`)
console.log('  ✅ Auto-matched: ~7 | 🟡 Suggested: 1 (Yvonne Stafford wrong plan number)')
console.log('\n🚨 Charging-without-service flags (4 clients):')
console.log('  Patricia Sinclair — last review Nov 2023')
console.log('  Victoria Pemberton — last review Sep 2023')
console.log('  Ian Crompton — last review Oct 2023')
console.log('  Vivienne Caldwell — last review Dec 2023')

console.log('\n📧 Demo flow:')
console.log('  1. Onboard as "Meridian Wealth" → upload meridian-wealth-clients.xlsx')
console.log('  2. Send quilter-meridian-oct-2024.xlsx to meridian-wealth@readmedb.com')
console.log('  3. Optionally add transact & fidelity as attachments in same email for batch demo')
