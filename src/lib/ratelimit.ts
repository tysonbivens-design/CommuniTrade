// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Keyed by any string (IP, userId, or combo). Resets on Vercel cold start,
// which is fine — this is a defence-in-depth layer on top of DB checks.

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune stale entries every 100 calls to prevent memory creep
let callCount = 0
function maybePrune() {
  if (++callCount % 100 !== 0) return
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * @param key     Unique identifier (e.g. IP, userId, or `${ip}:${userId}`)
 * @param limit   Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  maybePrune()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

/** Extract the real client IP from a Next.js request */
export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}
