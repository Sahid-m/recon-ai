import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const API_BASE = process.env.INTELLIFLO_API_BASE ?? 'https://api.gb.intelliflo.net'
const TOKEN_URL = 'https://identity.gb.intelliflo.net/core/connect/token'

interface IntelliFlo_Client {
  id: number
  reference?: string
  personalDetails?: {
    forename?: string
    surname?: string
    title?: string
  }
  companyDetails?: { name?: string }
}

interface IntelliFlo_Plan {
  id: number
  reference?: string
  planType?: string
  provider?: { name?: string }
  status?: string
  advisorChargeAmount?: number
  charges?: Array<{
    chargeType?: string
    amount?: number
    frequency?: string
  }>
}

interface PagedResponse<T> {
  items?: T[]
  paging?: { totalCount: number; skip: number; take: number }
}

async function getValidToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('intelliflo_tokens')?.value
  if (!raw) return null

  const stored = JSON.parse(raw) as {
    access_token: string
    refresh_token?: string
    expires_at: number
  }

  // Still valid
  if (stored.expires_at > Date.now() + 60_000) return stored.access_token

  // Try to refresh
  if (!stored.refresh_token) return null

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
      client_id: process.env.INTELLIFLO_CLIENT_ID!,
      client_secret: process.env.INTELLIFLO_CLIENT_SECRET!,
    }).toString(),
  })

  if (!res.ok) return null

  const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }

  cookieStore.set('intelliflo_tokens', JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? stored.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expires_in,
    path: '/',
  })

  return tokens.access_token
}

function ifloHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-api-key': process.env.INTELLIFLO_API_KEY ?? '',
    Accept: 'application/json',
  }
}

async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const items: T[] = []
  let skip = 0
  const take = 100

  while (true) {
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}skip=${skip}&take=${take}`, { headers })
    if (!res.ok) break
    const data: PagedResponse<T> = await res.json()
    const batch = data.items ?? []
    items.push(...batch)
    if (batch.length < take) break
    skip += take
  }

  return items
}

export async function GET() {
  const token = await getValidToken()
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated with Intelliflo', auth: false }, { status: 401 })
  }

  const headers = ifloHeaders(token)

  // Fetch all clients
  const clients = await fetchAllPages<IntelliFlo_Client>(`${API_BASE}/v1/clients`, headers)

  if (clients.length === 0) {
    return NextResponse.json({ clients: [], count: 0 })
  }

  // Fetch plans for each client (in parallel, batched to avoid hammering the API)
  const BATCH = 10
  const mapped: Array<{
    name: string
    clientId: string
    planNumber: string
    platform: string
    expectedMonthlyFee: number
  }> = []

  for (let i = 0; i < clients.length; i += BATCH) {
    const batch = clients.slice(i, i + BATCH)
    await Promise.all(batch.map(async (client) => {
      const name = client.personalDetails
        ? [client.personalDetails.forename, client.personalDetails.surname].filter(Boolean).join(' ')
        : client.companyDetails?.name ?? `Client ${client.id}`

      const clientId = client.reference ?? String(client.id)

      // Try to get their plans/portfolios
      let plans: IntelliFlo_Plan[] = []
      try {
        plans = await fetchAllPages<IntelliFlo_Plan>(
          `${API_BASE}/v1/clients/${client.id}/plans`,
          headers
        )
      } catch { /* some clients may have no plans endpoint */ }

      if (plans.length === 0) {
        // Client without plans — add as a record with no plan number
        mapped.push({ name, clientId, planNumber: '', platform: 'Unknown', expectedMonthlyFee: 0 })
        return
      }

      for (const plan of plans) {
        if (plan.status && plan.status.toLowerCase() === 'closed') continue

        const planNumber = plan.reference ?? `${clientId}-${plan.id}`
        const platform = plan.provider?.name ?? 'Unknown'

        // Try to get monthly fee from charges
        let expectedMonthlyFee = 0
        if (plan.charges?.length) {
          const charge = plan.charges.find(c =>
            c.chargeType?.toLowerCase().includes('adviser') ||
            c.chargeType?.toLowerCase().includes('ongoing')
          ) ?? plan.charges[0]

          if (charge?.amount) {
            // Normalise to monthly
            const freq = (charge.frequency ?? 'monthly').toLowerCase()
            expectedMonthlyFee = freq.includes('annual') ? charge.amount / 12
              : freq.includes('quarter') ? charge.amount / 3
              : charge.amount
          }
        } else if (plan.advisorChargeAmount) {
          expectedMonthlyFee = plan.advisorChargeAmount
        }

        mapped.push({ name, clientId, planNumber, platform, expectedMonthlyFee })
      }
    }))
  }

  return NextResponse.json({ clients: mapped, count: mapped.length, source: 'intelliflo' })
}
