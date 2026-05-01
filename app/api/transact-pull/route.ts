import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Transact Data Services API
// Docs/access: tol@integrafin.co.uk
// Postman: https://documenter.getpostman.com/view/8344085/2sAYX9ogTh
const TRANSACT_API_BASE = process.env.TRANSACT_API_BASE ?? 'https://api.transact-online.co.uk'

interface TransactRemunerationItem {
  clientName?: string
  clientRef?: string
  planNumber?: string
  planRef?: string
  transactionCode?: string
  transactionDescription?: string
  grossAmount?: number
  netAmount?: number
  vatAmount?: number
  paymentDate?: string
  statementDate?: string
  adviserRef?: string
}

interface TransactRemunerationResponse {
  items?: TransactRemunerationItem[]
  totalCount?: number
  pageNumber?: number
  pageSize?: number
}

async function fetchTransactPages(
  adviserId: string,
  apiKey: string,
  fromDate?: string,
  toDate?: string,
): Promise<TransactRemunerationItem[]> {
  const items: TransactRemunerationItem[] = []
  let page = 1
  const pageSize = 100

  while (true) {
    const params = new URLSearchParams({
      adviserId,
      pageNumber: String(page),
      pageSize: String(pageSize),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    })

    const res = await fetch(
      `${TRANSACT_API_BASE}/v2/remuneration?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'x-adviser-id': adviserId,
        },
      }
    )

    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`Transact API ${res.status}: ${detail}`)
    }

    const data: TransactRemunerationResponse = await res.json()
    const batch = data.items ?? []
    items.push(...batch)

    if (batch.length < pageSize) break
    page++
  }

  return items
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    firmName?: string
    adviserId?: string
    apiKey?: string
    fromDate?: string
    toDate?: string
  }

  const adviserId = body.adviserId?.trim()
  const apiKey = body.apiKey?.trim()

  if (!adviserId || !apiKey) {
    return NextResponse.json({ error: 'adviserId and apiKey are required' }, { status: 400 })
  }

  try {
    const items = await fetchTransactPages(adviserId, apiKey, body.fromDate, body.toDate)

    const rows = items.map(item => ({
      clientName: item.clientName ?? item.clientRef ?? 'Unknown',
      planNumber: item.planNumber ?? item.planRef ?? '',
      feeType: item.transactionDescription ?? item.transactionCode ?? 'Adviser Charge',
      grossAmount: item.grossAmount ?? item.netAmount ?? 0,
      paymentDate: item.paymentDate ?? item.statementDate ?? '',
      platformName: 'Transact',
    }))

    return NextResponse.json({
      platform: 'Transact',
      firmName: body.firmName ?? adviserId,
      rows,
      count: rows.length,
      pulledAt: new Date().toISOString(),
    })

  } catch (err) {
    const message = String(err)

    // Credentials not yet issued — return informative response
    if (message.includes('401') || message.includes('403')) {
      return NextResponse.json(
        { error: 'Transact credentials invalid or not yet active. Contact tol@integrafin.co.uk to get API access.' },
        { status: 401 }
      )
    }
    if (message.includes('ENOTFOUND') || message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Could not reach Transact API. Verify TRANSACT_API_BASE in .env.local.' },
        { status: 502 }
      )
    }

    console.error('Transact pull error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
