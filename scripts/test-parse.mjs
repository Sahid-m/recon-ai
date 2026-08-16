const KEY = process.env.READMEDB_API_KEY
if (!KEY) throw new Error('READMEDB_API_KEY environment variable is required')
const res = await fetch('https://app.readmedb.com/api/v1/files/hartley-partners.md', {
  headers: { Authorization: `Bearer ${KEY}` }
})
const json = await res.json()
const content = json.content ?? ''

const startMarker = '```json clients\n'
const startIdx = content.indexOf(startMarker)
console.log('startIdx:', startIdx)

if (startIdx !== -1) {
  const afterMarker = content.slice(startIdx + startMarker.length)
  const endIdx = afterMarker.search(/\n```(\n|$)/)
  console.log('endIdx:', endIdx)
  const jsonStr = afterMarker.slice(0, endIdx).trim()
  const clients = JSON.parse(jsonStr)
  console.log('✅ Parsed', clients.length, 'clients')
  console.log('First:', clients[0].name, clients[0].planNumber)
}
