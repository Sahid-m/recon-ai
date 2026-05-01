import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const runtime = 'nodejs'

const AUTH_URL = 'https://identity.gb.intelliflo.net/core/connect/authorize'

export async function GET(req: NextRequest) {
  const clientId = process.env.INTELLIFLO_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'INTELLIFLO_CLIENT_ID not configured' }, { status: 500 })
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/auth/intelliflo/callback`

  // CSRF state token
  const state = crypto.randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('intelliflo_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 min
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile client_data client_financial_data',
    state,
  })

  return NextResponse.redirect(`${AUTH_URL}?${params.toString()}`)
}
