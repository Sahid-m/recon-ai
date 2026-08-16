const KEY = process.env.READMEDB_API_KEY
if (!KEY) throw new Error('READMEDB_API_KEY environment variable is required')
const BASE = 'https://app.readmedb.com/api/v1'

const clients = [
  { name: 'James Hargreaves',   clientId: 'HP001', planNumber: 'QU-448821', platform: 'Quilter', expectedMonthlyFee: 412.50 },
  { name: 'Margaret Thornton',  clientId: 'HP002', planNumber: 'QU-229034', platform: 'Quilter', expectedMonthlyFee: 285.00 },
  { name: 'David Patel',        clientId: 'HP003', planNumber: 'QU-998821', platform: 'Quilter', expectedMonthlyFee: 620.00 },
  { name: 'Sarah Wentworth',    clientId: 'HP004', planNumber: 'QU-447102', platform: 'Quilter', expectedMonthlyFee: 195.75 },
  { name: 'Robert Ashworth',    clientId: 'HP005', planNumber: 'QU-334455', platform: 'Quilter', expectedMonthlyFee: 530.00 },
  { name: 'Patricia Newcombe',  clientId: 'HP006', planNumber: 'QU-221987', platform: 'Quilter', expectedMonthlyFee: 340.00 },
  { name: 'Thomas Ellison',     clientId: 'HP007', planNumber: 'QU-778831', platform: 'Quilter', expectedMonthlyFee: 875.00 },
  { name: 'Jennifer Blackwood', clientId: 'HP008', planNumber: 'QU-556620', platform: 'Quilter', expectedMonthlyFee: 150.00 },
  { name: 'William Forsythe',   clientId: 'HP009', planNumber: 'QU-112233', platform: 'Quilter', expectedMonthlyFee: 960.00 },
  { name: 'Caroline Stephens',  clientId: 'HP010', planNumber: 'QU-887744', platform: 'Quilter', expectedMonthlyFee: 225.00 },
]

// Read existing file
const getRes = await fetch(`${BASE}/files/hartley-partners.md`, {
  headers: { Authorization: `Bearer ${KEY}` }
})
const data = await getRes.json()
const existing = data.content ?? ''

// Prepend client block to existing content
const clientBlock = `\`\`\`json clients\n${JSON.stringify(clients, null, 2)}\n\`\`\``
const newContent = clientBlock + '\n\n' + existing

const putRes = await fetch(`${BASE}/files/hartley-partners.md`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: newContent })
})
console.log('PUT status:', putRes.status)
console.log('✅ Client block written. Verify:')

// Verify
const verify = await fetch(`${BASE}/files/hartley-partners.md`, {
  headers: { Authorization: `Bearer ${KEY}` }
})
const v = await verify.json()
const hasBlock = v.content?.includes('```json clients')
console.log('Has client block:', hasBlock)
const m = v.content?.match(/```json clients\n([\s\S]+?)\n```/)
if (m) console.log('Client count:', JSON.parse(m[1]).length)
