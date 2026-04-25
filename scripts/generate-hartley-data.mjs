import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'

// ── Hartley Partners client list ─────────────────────────────────────────────
const clients = [
  { name: 'James Hargreaves',   clientId: 'HP001', planNumber: 'QU-448821', platform: 'Quilter',  expectedMonthlyFee: 412.50 },
  { name: 'Margaret Thornton',  clientId: 'HP002', planNumber: 'QU-229034', platform: 'Quilter',  expectedMonthlyFee: 285.00 },
  { name: 'David Patel',        clientId: 'HP003', planNumber: 'QU-998821', platform: 'Quilter',  expectedMonthlyFee: 620.00 },
  { name: 'Sarah Wentworth',    clientId: 'HP004', planNumber: 'QU-447102', platform: 'Quilter',  expectedMonthlyFee: 195.75 },
  { name: 'Robert Ashworth',    clientId: 'HP005', planNumber: 'QU-334455', platform: 'Quilter',  expectedMonthlyFee: 530.00 },
  { name: 'Patricia Newcombe',  clientId: 'HP006', planNumber: 'QU-221987', platform: 'Quilter',  expectedMonthlyFee: 340.00 },
  { name: 'Thomas Ellison',     clientId: 'HP007', planNumber: 'QU-778831', platform: 'Quilter',  expectedMonthlyFee: 875.00 },
  { name: 'Jennifer Blackwood', clientId: 'HP008', planNumber: 'QU-556620', platform: 'Quilter',  expectedMonthlyFee: 150.00 },
  { name: 'William Forsythe',   clientId: 'HP009', planNumber: 'QU-112233', platform: 'Quilter',  expectedMonthlyFee: 960.00 },
  { name: 'Caroline Stephens',  clientId: 'HP010', planNumber: 'QU-887744', platform: 'Quilter',  expectedMonthlyFee: 225.00 },
]

// ── Quilter statement — 7 match, 1 wrong amount, 1 wrong plan, 1 missing ─────
const statementRows = [
  // Auto-matched (plan + name exact)
  { 'Client Name': 'James Hargreaves',   'Plan Number': 'QU-448821', 'Fee Type': 'Adviser Charge', 'Gross Amount': 412.50,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  { 'Client Name': 'Margaret Thornton',  'Plan Number': 'QU-229034', 'Fee Type': 'Adviser Charge', 'Gross Amount': 285.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  { 'Client Name': 'David Patel',        'Plan Number': 'QU-998821', 'Fee Type': 'Adviser Charge', 'Gross Amount': 620.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  { 'Client Name': 'Sarah Wentworth',    'Plan Number': 'QU-447102', 'Fee Type': 'Adviser Charge', 'Gross Amount': 195.75,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  { 'Client Name': 'Robert Ashworth',    'Plan Number': 'QU-334455', 'Fee Type': 'Adviser Charge', 'Gross Amount': 530.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  // Wrong amount — should trigger anomaly (paid 290 instead of 340)
  { 'Client Name': 'Patricia Newcombe',  'Plan Number': 'QU-221987', 'Fee Type': 'Adviser Charge', 'Gross Amount': 290.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  { 'Client Name': 'Thomas Ellison',     'Plan Number': 'QU-778831', 'Fee Type': 'Adviser Charge', 'Gross Amount': 875.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  // Slightly wrong plan number — fuzzy match (suggested tier)
  { 'Client Name': 'J Blackwood',        'Plan Number': 'QU-556621', 'Fee Type': 'Adviser Charge', 'Gross Amount': 150.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  // Unknown client — unmatched (should flag as anomaly)
  { 'Client Name': 'Andrew McAllister', 'Plan Number': 'QU-999001', 'Fee Type': 'Adviser Charge', 'Gross Amount': 780.00,  'Payment Date': '31/10/2024', 'Platform': 'Quilter' },
  // William Forsythe and Caroline Stephens missing — zero income this month
]

// Write client list Excel
const clientWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(clientWb, XLSX.utils.json_to_sheet(clients), 'Clients')
XLSX.writeFile(clientWb, 'public/hartley-partners-clients.xlsx')
console.log('✅ Written: public/hartley-partners-clients.xlsx')

// Write statement Excel (Quilter format, two sheets like real Quilter)
const stmtWb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(stmtWb, XLSX.utils.json_to_sheet(statementRows), 'Non-Pension')
XLSX.utils.book_append_sheet(stmtWb, XLSX.utils.json_to_sheet([]), 'Pension') // empty pension sheet, realistic
XLSX.writeFile(stmtWb, 'public/quilter-hartley-oct-2024.xlsx')
console.log('✅ Written: public/quilter-hartley-oct-2024.xlsx')

console.log('\n📊 Test expectations:')
console.log('  ✅ Auto-matched: 5 rows (James, Margaret, David, Sarah, Robert, Thomas + maybe Patricia)')
console.log('  🟡 Suggested:   1 row  (J Blackwood → Jennifer Blackwood, plan off by 1 digit)')
console.log('  🔴 Unmatched:   1 row  (Andrew McAllister — unknown client)')
console.log('  ⚠️  Missing:     2 clients (William Forsythe, Caroline Stephens — zero income)')
console.log('  💰 Gap:         £50 short (Patricia paid £290, expected £340)')
console.log('\n📧 Send quilter-hartley-oct-2024.xlsx to: hartley-partners@readmedb.com')
