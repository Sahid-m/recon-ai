import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { firmName, adviserId, apiKey } = await req.json() as {
    firmName?: string
    adviserId?: string
    apiKey?: string
  }

  if (!adviserId || !apiKey) {
    return NextResponse.json({ error: 'adviserId and apiKey are required' }, { status: 400 })
  }

  // Simulate a real API call latency
  await new Promise(r => setTimeout(r, 800))

  return NextResponse.json({
    platform: 'Transact',
    firmName: firmName ?? 'Unknown',
    rows: [
      {
        clientName: 'James Hargreaves',
        planNumber: 'TR-448821',
        feeType: 'Adviser Charge',
        grossAmount: 412.50,
        paymentDate: '2024-10-31',
        platformName: 'Transact',
      },
      {
        clientName: 'Sarah Wentworth',
        planNumber: 'TR-447102',
        feeType: 'Adviser Charge',
        grossAmount: 195.75,
        paymentDate: '2024-10-31',
        platformName: 'Transact',
      },
      {
        clientName: 'David Patel',
        planNumber: 'TR-998821',
        feeType: 'Adviser Charge',
        grossAmount: 620.00,
        paymentDate: '2024-10-31',
        platformName: 'Transact',
      },
      {
        clientName: 'Michael Drummond',
        planNumber: 'TR-661543',
        feeType: 'Adviser Charge',
        grossAmount: 490.00,
        paymentDate: '2024-10-31',
        platformName: 'Transact',
      },
      {
        clientName: 'Richard Fernsby',
        planNumber: 'TR-889012',
        feeType: 'Adviser Charge',
        grossAmount: 175.00,
        paymentDate: '2024-10-31',
        platformName: 'Transact',
      },
    ],
    pulledAt: '2024-10-31T09:00:00Z',
    mock: true,
  })
}
