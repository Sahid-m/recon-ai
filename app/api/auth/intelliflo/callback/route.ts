import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const TOKEN_URL = 'https://identity.gb.intelliflo.net/core/connect/token'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('intelliflo_oauth_state')?.value

  // Clear state cookie
  cookieStore.delete('intelliflo_oauth_state')

  if (error) {
    return NextResponse.redirect(`${origin}/onboarding?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/onboarding?error=invalid_state`)
  }

  const clientId = process.env.INTELLIFLO_CLIENT_ID!
  const clientSecret = process.env.INTELLIFLO_CLIENT_SECRET!
  const redirectUri = `${origin}/api/auth/intelliflo/callback`

  // Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('Intelliflo token exchange failed:', tokenRes.status, detail)
    return NextResponse.redirect(
      `${origin}/onboarding?error=${encodeURIComponent(`token_exchange_failed: ${tokenRes.status} ${detail}`)}`
    )
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }

  // Store tokens in httpOnly cookie (expires with the access token)
  const tokenPayload = JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  })

  cookieStore.set('intelliflo_tokens', tokenPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expires_in,
    path: '/',
  })

  return NextResponse.redirect(`${origin}/onboarding?intelliflo=connected`)
}
