import { NextRequest, NextResponse } from 'next/server'
import { getFirmFile } from '../../../lib/readmedb'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const firmName = req.nextUrl.searchParams.get('firm')
  if (!firmName) return NextResponse.json({ error: 'Missing firm' }, { status: 400 })

  try {
    const content = await getFirmFile(firmName)
    return NextResponse.json({ content })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
