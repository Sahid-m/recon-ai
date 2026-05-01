/**
 * Tests the full convert → classify → parse pipeline against various
 * real-world Excel/CSV formats. Run with: npx tsx scripts/test-parse.ts
 */

import * as XLSX from 'xlsx'
import { convertFile } from '../lib/converters'
import { classify } from '../agents/classifier'
import { parse } from '../agents/parser'

// Load env manually (no dotenv dep needed)
import { readFileSync } from 'fs'
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* no .env.local */ }

// ─── Test file factories ───────────────────────────────────────────────────────

function makeFile(buffer: Buffer, name: string): File {
  const ab = buffer.buffer as ArrayBuffer
  const slice = ab.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  return new File([slice], name, { type: 'application/octet-stream' })
}

function excelBuffer(sheets: { name: string; rows: unknown[][] }[]): Buffer {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

const TEST_CASES: Array<{ name: string; file: File; expectRows: number }> = [

  // 1. Standard clean CSV — should be trivial
  {
    name: '1. Clean standard CSV',
    expectRows: 4,
    file: makeFile(
      Buffer.from(
        `Client Name,Plan Number,Fee Type,Gross Amount,Payment Date,Platform\n` +
        `James Hargreaves,QU-448821,Ongoing Adviser Charge,412.50,2024-10-01,Quilter\n` +
        `Margaret Thornton,QU-229034,Trail Commission,285.00,2024-10-01,Quilter\n` +
        `David Patel,TR-998821,Adviser Charge,620.00,2024-10-01,Transact\n` +
        `Sarah Wentworth,TR-447102,Ongoing Adviser Charge,195.75,2024-10-15,Transact\n`
      ),
      'standard.csv'
    ),
  },

  // 2. Non-standard headers — common in Fidelity-style exports
  {
    name: '2. Non-standard Fidelity-style headers',
    expectRows: 3,
    file: makeFile(
      excelBuffer([{
        name: 'Sheet1',
        rows: [
          ['Investor', 'Policy Ref', 'Charge Description', 'Net Charge (£)', 'Effective Date'],
          ['Robert Ashworth', 'FI-334455', 'Initial Charge', 530.00, '01/10/2024'],
          ['Patricia Newcombe', 'FI-221987', 'Renewal Commission', 340.00, '15/10/2024'],
          ['Thomas Ellison', 'FI-778831', 'Adviser Fee', 875.00, '01/10/2024'],
        ],
      }]),
      'fidelity-style.xlsx'
    ),
  },

  // 3. No headers at all — pure positional columns (A, B, C...)
  {
    name: '3. No headers — positional columns only',
    expectRows: 3,
    file: makeFile(
      excelBuffer([{
        name: 'Data',
        rows: [
          ['Jennifer Blackwood', 'AJ-556620', 'Adviser Charge', 150.00, '2024-10-01'],
          ['Charles Pemberton', 'AE-103456', 'Trail Commission', 460.00, '2024-10-05'],
          ['Amanda Forsythe', 'AE-209871', 'Ongoing Fee', 310.00, '2024-10-10'],
        ],
      }]),
      'no-headers.xlsx'
    ),
  },

  // 4. Multi-sheet workbook (Quilter pension/non-pension split)
  {
    name: '4. Multi-sheet workbook (Quilter-style pension split)',
    expectRows: 4,
    file: makeFile(
      excelBuffer([
        {
          name: 'ISA & GIA',
          rows: [
            ['Client Name', 'Plan Number', 'Fee Type', 'Gross Amount', 'Payment Date'],
            ['William Garside', 'QU-551234', 'Ongoing Adviser Charge', 720.00, '01/10/2024'],
            ['Helen Cartwright', 'QU-330912', 'Trail Commission', 255.00, '01/10/2024'],
          ],
        },
        {
          name: 'Pension',
          rows: [
            ['Client Name', 'Plan Number', 'Fee Type', 'Gross Amount', 'Payment Date'],
            ['Michael Drummond', 'QU-661543', 'Adviser Charge', 490.00, '01/10/2024'],
            ['Susan Whitfield', 'QU-445122', 'Ongoing Charge', 380.00, '01/10/2024'],
          ],
        },
      ]),
      'quilter-multisheet.xlsx'
    ),
  },

  // 5. Messy real-world export — extra metadata rows at top, amount has £ symbol
  {
    name: '5. Messy export — metadata header rows + £ symbols',
    expectRows: 3,
    file: makeFile(
      excelBuffer([{
        name: 'Income Report',
        rows: [
          ['AJ Bell Youinvest — Monthly Income Report'],
          ['Generated: 01 November 2024'],
          ['Period: October 2024'],
          [],
          ['Account Holder', 'Reference No.', 'Transaction Type', 'Amount Paid', 'Date Paid'],
          ['Geoffrey Stanton',  'AJ-334490', 'Initial Adviser Charge',  '£215.00', '01/10/2024'],
          ['Catherine Lowe',    'AJ-772341', 'Ongoing Adviser Charge',  '£640.00', '15/10/2024'],
          ['Richard Fernsby',   'AJ-889012', 'Trail Commission',         '£175.00', '31/10/2024'],
        ],
      }]),
      'ajbell-messy.xlsx'
    ),
  },

  // 6. Amount as string with commas (£1,234.56 format)
  {
    name: '6. Comma-formatted amounts (£1,234.56)',
    expectRows: 2,
    file: makeFile(
      Buffer.from(
        `Name,Plan,Type,Fee,Date\n` +
        `Elizabeth Moorfield,AE-334871,Ongoing Adviser Charge,"£1,234.56",2024-10-01\n` +
        `Jonathan Barker,FI-556001,Trail Commission,"£2,345.00",2024-10-15\n`
      ),
      'comma-amounts.csv'
    ),
  },

]

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runTest(tc: typeof TEST_CASES[0]) {
  const start = Date.now()
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`▶  ${tc.name}`)
  console.log(`${'─'.repeat(60)}`)

  try {
    // Step 1: Convert
    const converted = await convertFile(tc.file)
    const sheetNames = Object.keys(converted.sheets)
    console.log(`   Sheets: ${sheetNames.join(', ')}`)
    for (const [name, csv] of Object.entries(converted.sheets)) {
      const lines = csv.split('\n').filter(Boolean)
      console.log(`   [${name}] ${lines.length} rows — first line: ${lines[0]?.slice(0, 80)}`)
    }

    // Step 2: Classify
    console.log('   Classifying...')
    const cls = await classify(converted.sheets)
    console.log(`   Platform: ${cls.platform}`)
    console.log(`   Quirks:   ${cls.quirks.join(', ') || 'none'}`)
    console.log(`   Columns:  ${JSON.stringify(cls.columnMap)}`)

    // Step 3: Parse
    console.log('   Parsing rows...')
    const rows = await parse(converted.sheets, cls)
    console.log(`   Extracted ${rows.length} rows (expected ~${tc.expectRows})`)
    for (const r of rows) {
      console.log(`     · ${r.clientName.padEnd(25)} ${r.planNumber.padEnd(12)} ${String(r.grossAmount).padStart(8)} ${r.paymentDate}`)
    }

    const ok = rows.length >= tc.expectRows
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`   ${ok ? '✅ PASS' : '⚠️  PARTIAL'} — ${elapsed}s`)
    return { name: tc.name, pass: ok, rows: rows.length, expected: tc.expectRows }

  } catch (err) {
    console.log(`   ❌ ERROR: ${err}`)
    return { name: tc.name, pass: false, rows: 0, expected: tc.expectRows, error: String(err) }
  }
}

async function main() {
  console.log('\n🧪 Recon AI — Parser Pipeline Test')
  console.log(`   Model: ${process.env.AI_PROVIDER}/${process.env.AI_MODEL}`)
  console.log(`   ${TEST_CASES.length} test cases\n`)

  const results = []
  for (const tc of TEST_CASES) {
    results.push(await runTest(tc))
  }

  console.log('\n' + '═'.repeat(60))
  console.log('SUMMARY')
  console.log('═'.repeat(60))
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌'
    console.log(`  ${icon} ${r.name}  (${r.rows}/${r.expected} rows)`)
  }
  const passed = results.filter(r => r.pass).length
  console.log(`\n  ${passed}/${results.length} passed`)
}

main().catch(console.error)
