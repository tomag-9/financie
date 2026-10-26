type Bucket = { failures: number[]; blockedUntil: number }

const globalBuckets = globalThis as unknown as { authRateLimits?: Map<string, Bucket> }
const buckets = globalBuckets.authRateLimits ?? new Map<string, Bucket>()
globalBuckets.authRateLimits = buckets

const WINDOW_MS = 15 * 60_000
const BLOCK_MS = 15 * 60_000
const MAX_FAILURES = 5

export function rateLimitKey(headers: Headers, scope: string) {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `${scope}:${forwarded || headers.get('x-real-ip') || 'unknown'}`
}

export function isRateLimited(key: string, now = Date.now()) {
  const bucket = buckets.get(key)
  if (!bucket) return false
  if (bucket.blockedUntil > now) return true
  bucket.failures = bucket.failures.filter((time) => now - time < WINDOW_MS)
  if (bucket.failures.length < MAX_FAILURES) return false
  bucket.blockedUntil = now + BLOCK_MS
  return true
}

export function recordRateLimitFailure(key: string, now = Date.now()) {
  const bucket = buckets.get(key) ?? { failures: [], blockedUntil: 0 }
  bucket.failures = bucket.failures.filter((time) => now - time < WINDOW_MS)
  bucket.failures.push(now)
  if (bucket.failures.length >= MAX_FAILURES) bucket.blockedUntil = now + BLOCK_MS
  buckets.set(key, bucket)
}

export function clearRateLimit(key: string) {
  buckets.delete(key)
}
