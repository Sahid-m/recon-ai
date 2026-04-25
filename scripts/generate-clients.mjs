import * as XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const clients = [
  { 'Client Name': 'James Hargreaves', 'Client ID': 'CLI001', 'Plan Number': 'QU-448821', 'Platform': 'Quilter', 'Expected Monthly Fee': 412.50 },
  { 'Client Name': 'Margaret Thornton', 'Client ID': 'CLI002', 'Plan Number': 'QU-229034', 'Platform': 'Quilter', 'Expected Monthly Fee': 285.00 },
  { 'Client Name': 'David Patel', 'Client ID': 'CLI003', 'Plan Number': 'TR-998821', 'Platform': 'Transact', 'Expected Monthly Fee': 620.00 },
  { 'Client Name': 'Sarah Wentworth', 'Client ID': 'CLI004', 'Plan Number': 'TR-447102', 'Platform': 'Transact', 'Expected Monthly Fee': 195.75 },
  { 'Client Name': 'Robert Ashworth', 'Client ID': 'CLI005', 'Plan Number': 'FI-334455', 'Platform': 'Fidelity', 'Expected Monthly Fee': 530.00 },
  { 'Client Name': 'Patricia Newcombe', 'Client ID': 'CLI006', 'Plan Number': 'FI-221987', 'Platform': 'Fidelity', 'Expected Monthly Fee': 340.00 },
  { 'Client Name': 'Thomas Ellison', 'Client ID': 'CLI007', 'Plan Number': 'AJ-778831', 'Platform': 'AJ Bell', 'Expected Monthly Fee': 875.00 },
  { 'Client Name': 'Jennifer Blackwood', 'Client ID': 'CLI008', 'Plan Number': 'AJ-556620', 'Platform': 'AJ Bell', 'Expected Monthly Fee': 150.00 },
  { 'Client Name': 'Charles Pemberton', 'Client ID': 'CLI009', 'Plan Number': 'AE-103456', 'Platform': 'Aegon', 'Expected Monthly Fee': 460.00 },
  { 'Client Name': 'Amanda Forsythe', 'Client ID': 'CLI010', 'Plan Number': 'AE-209871', 'Platform': 'Aegon', 'Expected Monthly Fee': 310.00 },
  { 'Client Name': 'William Garside', 'Client ID': 'CLI011', 'Plan Number': 'QU-551234', 'Platform': 'Quilter', 'Expected Monthly Fee': 720.00 },
  { 'Client Name': 'Helen Cartwright', 'Client ID': 'CLI012', 'Plan Number': 'QU-330912', 'Platform': 'Quilter', 'Expected Monthly Fee': 255.00 },
  { 'Client Name': 'Michael Drummond', 'Client ID': 'CLI013', 'Plan Number': 'TR-661543', 'Platform': 'Transact', 'Expected Monthly Fee': 490.00 },
  { 'Client Name': 'Susan Whitfield', 'Client ID': 'CLI014', 'Plan Number': 'FI-445122', 'Platform': 'Fidelity', 'Expected Monthly Fee': 380.00 },
  { 'Client Name': 'Geoffrey Stanton', 'Client ID': 'CLI015', 'Plan Number': 'AJ-334490', 'Platform': 'AJ Bell', 'Expected Monthly Fee': 215.00 },
  { 'Client Name': 'Catherine Lowe', 'Client ID': 'CLI016', 'Plan Number': 'QU-772341', 'Platform': 'Quilter', 'Expected Monthly Fee': 640.00 },
  { 'Client Name': 'Richard Fernsby', 'Client ID': 'CLI017', 'Plan Number': 'TR-889012', 'Platform': 'Transact', 'Expected Monthly Fee': 175.00 },
  { 'Client Name': 'Elizabeth Moorfield', 'Client ID': 'CLI018', 'Plan Number': 'AE-334871', 'Platform': 'Aegon', 'Expected Monthly Fee': 920.00 },
  { 'Client Name': 'Jonathan Barker', 'Client ID': 'CLI019', 'Plan Number': 'FI-556001', 'Platform': 'Fidelity', 'Expected Monthly Fee': 445.00 },
  { 'Client Name': 'Diana Whitmore', 'Client ID': 'CLI020', 'Plan Number': 'QU-119234', 'Platform': 'Quilter', 'Expected Monthly Fee': 305.00 },
]

const ws = XLSX.utils.json_to_sheet(clients)
ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 22 }]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Clients')

const outPath = join(__dirname, '../public/demo-clients.xlsx')
XLSX.writeFile(wb, outPath)
console.log(`Written ${clients.length} clients to ${outPath}`)
