import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

const AUTH_BASE = 'https://www.ajbell.io/v1.0.0/ajbyi/authorisation'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const cookieStore = await cookies()
  const savedState = cookieStore.get('ajbell_oauth_state')?.value
  cookieStore.delete('ajbell_oauth_state')

  if (error) {
    return NextResponse.redirect(`${origin}/onboarding?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/onboarding?error=ajbell_invalid_state`)
  }

  const partnerToken = process.env.AJBELL_PARTNER_TOKEN!
  const redirectUri = `${origin}/api/auth/ajbell/callback`

  // Exchange code for OAuth token
  const tokenRes = await fetch(`${AUTH_BASE}/get-authentication-token`, {
    headers: {
      oAuthClientId: partnerToken,
      code,
      redirectURI: redirectUri,
    },
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('AJ Bell token exchange failed:', tokenRes.status, detail)
    return NextResponse.redirect(
      `${origin}/onboarding?error=${encodeURIComponent(`ajbell_token_failed: ${tokenRes.status} ${detail}`)}`
    )
  }

  const tokens = await tokenRes.json() as {
    authorization: string
    expires: number
    type: string
    scope: string
  }

  cookieStore.set('ajbell_tokens', JSON.stringify({
    access_token: tokens.authorization,
    expires_at: Date.now() + (tokens.expires ?? 3600) * 1000,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: tokens.expires ?? 3600,
    path: '/',
  })

  return NextResponse.redirect(`${origin}/onboarding?ajbell=connected`)
}
