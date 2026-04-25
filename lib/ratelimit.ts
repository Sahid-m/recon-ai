/**
 * Simple in-process sliding-window rate limiter.
 * Works without Redis — resets on server restart.
 * Good enough for hackathon / single-instance deploys.
 */

interface Window {
  timestamps: number[]
}

const store = new Map<string, Window>()

export interface RateLimitConfig {
  /** max requests allowed in the window */
  limit: number
  /** window size in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInMs: number
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowMs

  const entry = store.get(key) ?? { timestamps: [] }

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => t > windowStart)

  if (entry.timestamps.length >= config.limit) {
    const oldest = entry.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      resetInMs: oldest + config.windowMs - now,
    }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetInMs: 0,
  }
}

// Prune stale keys every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.timestamps.every(t => t < now - 60_000)) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

// ── Preset configs ────────────────────────────────────────────────────────────

/** Chat agent: 20 messages per minute per IP */
export const CHAT_LIMIT: RateLimitConfig = { limit: 20, windowMs: 60_000 }

/** Email webhook: 10 emails per hour per sender address */
export const EMAIL_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60 * 60_000 }

/** Parse endpoint: 10 file uploads per minute per IP */
export const PARSE_LIMIT: RateLimitConfig = { limit: 10, windowMs: 60_000 }
