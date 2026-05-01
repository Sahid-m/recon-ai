import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const API_BASE = 'https://www.ajbell.io/v1.0.0/ajbyi'

interface AJBellAccount {
  id: string
  name: string
  productType: string
  state: string
  holdingValuation: number
  cashValuation: number
  totalValuation: number
  currencyCode: string
}

interface AJBellTransaction {
  id?: string
  date?: string
  description?: string
  amount?: number
  type?: string
  reference?: string
}

function ajbellHeaders(token: string, partnerToken: string) {
  return {
    oAuthToken: token,
    partnerToken,
    Accept: 'application/json',
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('ajbell_tokens')?.value
  if (!raw) {
    return NextResponse.json({ error: 'Not authenticated with AJ Bell', auth: false }, { status: 401 })
  }

  const stored = JSON.parse(raw) as { access_token: string; expires_at: number }
  if (stored.expires_at < Date.now() + 60_000) {
    return NextResponse.json({ error: 'AJ Bell session expired — please reconnect', auth: false }, { status: 401 })
  }

  const partnerToken = process.env.AJBELL_PARTNER_TOKEN ?? ''
  const headers = ajbellHeaders(stored.access_token, partnerToken)

  // Fetch all accounts
  const accountsRes = await fetch(`${API_BASE}/accounts`, { headers })
  if (!accountsRes.ok) {
    const detail = await accountsRes.text()
    return NextResponse.json({ error: `AJ Bell accounts fetch failed: ${accountsRes.status} ${detail}` }, { status: 502 })
  }

  const accounts: AJBellAccount[] = await accountsRes.json()

  // Map accounts to client records + fetch recent transactions per account
  const BATCH = 5
  const mapped: Array<{
    name: string
    clientId: string
    planNumber: string
    platform: string
    expectedMonthlyFee: number
  }> = []

  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH)
    await Promise.all(batch.map(async (account) => {
      if (account.state?.toLowerCase() === 'closed') return

      let expectedMonthlyFee = 0

      try {
        const txRes = await fetch(`${API_BASE}/accounts/${account.id}/transactions`, { headers })
        if (txRes.ok) {
          const transactions: AJBellTransaction[] = await txRes.json()
          // Find adviser charge transactions to estimate monthly fee
          const charges = transactions.filter(t =>
            t.description?.toLowerCase().includes('adviser') ||
            t.description?.toLowerCase().includes('charge') ||
            t.type?.toLowerCase().includes('charge')
          )
          if (charges.length > 0) {
            const avg = charges.reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0) / charges.length
            expectedMonthlyFee = avg
          }
        }
      } catch { /* no transactions */ }

      mapped.push({
        name: account.name,
        clientId: account.id,
        planNumber: account.id,
        platform: `AJ Bell (${account.productType ?? 'Unknown'})`,
        expectedMonthlyFee,
      })
    }))
  }

  return NextResponse.json({ clients: mapped, count: mapped.length, source: 'ajbell' })
}
