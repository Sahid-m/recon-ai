import { NextResponse } from 'next/server'
import { rdbRead } from '../../../../lib/readmedb'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const raw = await rdbRead('_email-log.json')
    const logs = raw ? JSON.parse(raw) : []
    return NextResponse.json({ logs })
  } catch (e) {
    return NextResponse.json({ logs: [], error: String(e) })
  }
}
