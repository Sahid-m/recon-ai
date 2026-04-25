const KEY = 'rdb_1fed410b4eeb0f966d0a0b11aa91b272'
const BASE = 'https://app.readmedb.com/api/v1'

const res = await fetch(`${BASE}/files/hartley-partners.md`, {
  headers: { Authorization: `Bearer ${KEY}` }
})
const text = await res.text()
console.log('=== FILE CONTENT (first 3000 chars) ===')
console.log(text.slice(0, 3000))
console.log('\n=== Has json clients block? ===', text.includes('```json clients'))
console.log('=== Match attempt ===')
const m = text.match(/```json clients\n([\s\S]+?)\n```/)
console.log('Match found:', !!m)
if (m) {
  try {
    const clients = JSON.parse(m[1])
    console.log('Clients count:', clients.length)
    console.log('First client:', JSON.stringify(clients[0]))
  } catch(e) {
    console.log('JSON parse error:', e.message)
    console.log('Raw match[1]:', m[1].slice(0, 200))
  }
}
