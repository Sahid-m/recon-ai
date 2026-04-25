import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

// ── Meridian Wealth Management — 42 clients across 3 platforms ───────────────

const clients = [
  // Quilter clients (20)
  { name: 'Jonathan Whitfield',   clientId: 'MW001', planNumber: 'QU-112001', platform: 'Quilter',    expectedMonthlyFee: 875.00,  lastReviewDate: '2024-03-14' },
  { name: 'Susan Hartley',        clientId: 'MW002', planNumber: 'QU-112002', platform: 'Quilter',    expectedMonthlyFee: 420.00,  lastReviewDate: '2024-07-22' },
  { name: 'Robert Fleming',       clientId: 'MW003', planNumber: 'QU-112003', platform: 'Quilter',    expectedMonthlyFee: 1100.00, lastReviewDate: '2024-09-01' },
  { name: 'Catherine Brooks',     clientId: 'MW004', planNumber: 'QU-112004', platform: 'Quilter',    expectedMonthlyFee: 310.00,  lastReviewDate: '2024-01-10' },
  { name: 'Michael Davenport',    clientId: 'MW005', planNumber: 'QU-112005', platform: 'Quilter',    expectedMonthlyFee: 650.00,  lastReviewDate: '2024-08-30' },
  { name: 'Amanda Worthington',   clientId: 'MW006', planNumber: 'QU-112006', platform: 'Quilter',    expectedMonthlyFee: 485.00,  lastReviewDate: '2024-06-15' },
  { name: 'Peter Ashdown',        clientId: 'MW007', planNumber: 'QU-112007', platform: 'Quilter',    expectedMonthlyFee: 720.00,  lastReviewDate: '2024-02-28' },
  { name: 'Helen Cartwright',     clientId: 'MW008', planNumber: 'QU-112008', platform: 'Quilter',    expectedMonthlyFee: 195.00,  lastReviewDate: '2024-09-19' },
  { name: 'David Moorfield',      clientId: 'MW009', planNumber: 'QU-112009', platform: 'Quilter',    expectedMonthlyFee: 540.00,  lastReviewDate: '2024-05-03' },
  { name: 'Patricia Sinclair',    clientId: 'MW010', planNumber: 'QU-112010', platform: 'Quilter',    expectedMonthlyFee: 380.00,  lastReviewDate: '2023-11-12' }, // >12 months — CWS flag
  { name: 'Thomas Huntingdon',    clientId: 'MW011', planNumber: 'QU-112011', platform: 'Quilter',    expectedMonthlyFee: 925.00,  lastReviewDate: '2024-07-07' },
  { name: 'Elizabeth Norwood',    clientId: 'MW012', planNumber: 'QU-112012', platform: 'Quilter',    expectedMonthlyFee: 260.00,  lastReviewDate: '2024-08-11' },
  { name: 'James Pendleton',      clientId: 'MW013', planNumber: 'QU-112013', platform: 'Quilter',    expectedMonthlyFee: 1350.00, lastReviewDate: '2024-09-25' },
  { name: 'Caroline Forsythe',    clientId: 'MW014', planNumber: 'QU-112014', platform: 'Quilter',    expectedMonthlyFee: 445.00,  lastReviewDate: '2024-04-18' },
  { name: 'Richard Blackmore',    clientId: 'MW015', planNumber: 'QU-112015', platform: 'Quilter',    expectedMonthlyFee: 610.00,  lastReviewDate: '2024-08-05' },
  { name: 'Victoria Pemberton',   clientId: 'MW016', planNumber: 'QU-112016', platform: 'Quilter',    expectedMonthlyFee: 330.00,  lastReviewDate: '2023-09-30' }, // >12 months — CWS flag
  { name: 'Andrew Gloucester',    clientId: 'MW017', planNumber: 'QU-112017', platform: 'Quilter',    expectedMonthlyFee: 780.00,  lastReviewDate: '2024-07-14' },
  { name: 'Frances Whitmore',     clientId: 'MW018', planNumber: 'QU-112018', platform: 'Quilter',    expectedMonthlyFee: 415.00,  lastReviewDate: '2024-09-08' },
  { name: 'George Thornbury',     clientId: 'MW019', planNumber: 'QU-112019', platform: 'Quilter',    expectedMonthlyFee: 550.00,  lastReviewDate: '2024-06-22' },
  { name: 'Harriet Dunmore',      clientId: 'MW020', planNumber: 'QU-112020', platform: 'Quilter',    expectedMonthlyFee: 290.00,  lastReviewDate: '2024-08-17' },

  // Transact clients (14)
  { name: 'Charles Worthington',  clientId: 'MW021', planNumber: 'TR-220101', platform: 'Transact',   expectedMonthlyFee: 1200.00, lastReviewDate: '2024-09-12' },
  { name: 'Diana Ashworth',       clientId: 'MW022', planNumber: 'TR-220102', platform: 'Transact',   expectedMonthlyFee: 560.00,  lastReviewDate: '2024-07-31' },
  { name: 'Edward Collingwood',   clientId: 'MW023', planNumber: 'TR-220103', platform: 'Transact',   expectedMonthlyFee: 890.00,  lastReviewDate: '2024-08-20' },
  { name: 'Fiona Castleton',      clientId: 'MW024', planNumber: 'TR-220104', platform: 'Transact',   expectedMonthlyFee: 345.00,  lastReviewDate: '2024-03-05' },
  { name: 'Graham Willoughby',    clientId: 'MW025', planNumber: 'TR-220105', platform: 'Transact',   expectedMonthlyFee: 975.00,  lastReviewDate: '2024-09-18' },
  { name: 'Hannah Beaumont',      clientId: 'MW026', planNumber: 'TR-220106', platform: 'Transact',   expectedMonthlyFee: 410.00,  lastReviewDate: '2024-06-28' },
  { name: 'Ian Crompton',         clientId: 'MW027', planNumber: 'TR-220107', platform: 'Transact',   expectedMonthlyFee: 680.00,  lastReviewDate: '2023-10-15' }, // >12 months — CWS flag
  { name: 'Julia Ravenswood',     clientId: 'MW028', planNumber: 'TR-220108', platform: 'Transact',   expectedMonthlyFee: 225.00,  lastReviewDate: '2024-08-02' },
  { name: 'Kenneth Alderton',     clientId: 'MW029', planNumber: 'TR-220109', platform: 'Transact',   expectedMonthlyFee: 1450.00, lastReviewDate: '2024-09-05' },
  { name: 'Laura Standish',       clientId: 'MW030', planNumber: 'TR-220110', platform: 'Transact',   expectedMonthlyFee: 395.00,  lastReviewDate: '2024-07-09' },
  { name: 'Martin Elsworth',      clientId: 'MW031', planNumber: 'TR-220111', platform: 'Transact',   expectedMonthlyFee: 810.00,  lastReviewDate: '2024-09-22' },
  { name: 'Natasha Hollingsworth',clientId: 'MW032', planNumber: 'TR-220112', platform: 'Transact',   expectedMonthlyFee: 465.00,  lastReviewDate: '2024-04-30' },
  { name: 'Oliver Stratford',     clientId: 'MW033', planNumber: 'TR-220113', platform: 'Transact',   expectedMonthlyFee: 1050.00, lastReviewDate: '2024-08-26' },
  { name: 'Pamela Westhampton',   clientId: 'MW034', planNumber: 'TR-220114', platform: 'Transact',   expectedMonthlyFee: 320.00,  lastReviewDate: '2024-05-14' },

  // Fidelity clients (8)
  { name: 'Quentin Ashby',        clientId: 'MW035', planNumber: 'FI-330501', platform: 'Fidelity',   expectedMonthlyFee: 740.00,  lastReviewDate: '2024-09-03' },
  { name: 'Rebecca Dunstan',      clientId: 'MW036', planNumber: 'FI-330502', platform: 'Fidelity',   expectedMonthlyFee: 285.00,  lastReviewDate: '2024-07-16' },
  { name: 'Simon Weatherby',      clientId: 'MW037', planNumber: 'FI-330503', platform: 'Fidelity',   expectedMonthlyFee: 1100.00, lastReviewDate: '2024-08-08' },
  { name: 'Teresa Montague',      clientId: 'MW038', planNumber: 'FI-330504', platform: 'Fidelity',   expectedMonthlyFee: 495.00,  lastReviewDate: '2024-09-27' },
  { name: 'Ulric Pemberton',      clientId: 'MW039', planNumber: 'FI-330505', platform: 'Fidelity',   expectedMonthlyFee: 625.00,  lastReviewDate: '2024-06-11' },
  { name: 'Vivienne Caldwell',    clientId: 'MW040', planNumber: 'FI-330506', platform: 'Fidelity',   expectedMonthlyFee: 350.00,  lastReviewDate: '2023-12-20' }, // >12 months — CWS flag
  { name: 'Walter Kingsley',      clientId: 'MW041', planNumber: 'FI-330507', platform: 'Fidelity',   expectedMonthlyFee: 890.00,  lastReviewDate: '2024-08-29' },
  { name: 'Yvonne Stafford',      clientId: 'MW042', planNumber: 'FI-330508', platform: 'Fidelity',   expectedMonthlyFee: 420.00,  lastReviewDate: '2024-07-03' },
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
const quilterExpected = clients.filter(c => c.platform === 'Quilter').reduce((s, c) => s + c.expectedMonthlyFee, 0)
const quilterReceived = quilterRows.reduce((s, r) => s + r['Gross Amount'], 0)
const transactExpected = clients.filter(c => c.platform === 'Transact').reduce((s, c) => s + c.expectedMonthlyFee, 0)
const transactReceived = transactRows.reduce((s, r) => s + r['Gross Amount'], 0)
const fidelityExpected = clients.filter(c => c.platform === 'Fidelity').reduce((s, c) => s + c.expectedMonthlyFee, 0)
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
