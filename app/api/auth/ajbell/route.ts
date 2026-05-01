import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const runtime = 'nodejs'

// AJ Bell Developer Hub — OAuth 2.0
// Register at: https://www.ajbell.io
const AUTH_BASE = 'https://www.ajbell.io/v1.0.0/ajbyi/authorisation'

export async function GET(req: NextRequest) {
  const partnerToken = process.env.AJBELL_PARTNER_TOKEN
  if (!partnerToken) {
    return NextResponse.json({ error: 'AJBELL_PARTNER_TOKEN not configured' }, { status: 500 })
  }

  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/auth/ajbell/callback`

  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('ajbell_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  // AJ Bell: GET /authorisation/get-authentication-url
  // Returns a redirect URL to openbanking.youinvest2.co.uk
  const res = await fetch(`${AUTH_BASE}/get-authentication-url`, {
    headers: {
      oAuthClientId: partnerToken,
      redirectURI: redirectUri,
      signature: state,
    },
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('AJ Bell auth URL fetch failed:', res.status, detail)
    return NextResponse.json({ error: 'Failed to initiate AJ Bell OAuth' }, { status: 502 })
  }

  const data = await res.json() as { authenticationUrl?: string; url?: string }
  const authUrl = data.authenticationUrl ?? data.url

  if (!authUrl) {
    return NextResponse.json({ error: 'No auth URL returned by AJ Bell' }, { status: 502 })
  }

  return NextResponse.redirect(authUrl)
}
